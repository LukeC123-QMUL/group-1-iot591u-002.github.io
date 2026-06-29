(function () {
    'use strict';

    // --- State ---
    let activities = [];
    let results = null;

    // --- DOM refs ---
    const activityBody = document.getElementById('activity-body');
    const addBtn = document.getElementById('add-activity-btn');
    const calcBtn = document.getElementById('calculate-btn');
    const resultsSection = document.getElementById('results-section');
    const resultsBody = document.getElementById('results-body');
    const summaryBox = document.getElementById('summary-box');
    const toast = document.getElementById('error-toast');

    // --- ID generation ---
    function generateId(index) {
        if (index < 26) return String.fromCharCode(65 + index);
        return generateId(Math.floor(index / 26) - 1) + String.fromCharCode(65 + (index % 26));
    }

    // --- Activity management ---
    function addActivity() {
        activities.push({
            name: '',
            duration: '',
            dependencies: []
        });
        renderTable();
    }

    function removeActivity(index) {
        const removedId = generateId(index);
        activities.splice(index, 1);
        // Remove references to the deleted activity from dependencies
        activities.forEach(a => {
            a.dependencies = a.dependencies.filter(d => d !== removedId);
        });
        // Remap dependency IDs since indices shifted
        const oldIds = [];
        for (let i = 0; i <= activities.length; i++) oldIds.push(generateId(i));
        activities.forEach(a => {
            a.dependencies = a.dependencies.map(d => {
                const oldIndex = oldIds.indexOf(d);
                if (oldIndex > index) return generateId(oldIndex - 1);
                return d;
            }).filter(d => d !== removedId);
        });
        renderTable();
    }

    function renderTable() {
        activityBody.innerHTML = '';

        activities.forEach((activity, i) => {
            const id = generateId(i);
            const tr = document.createElement('tr');

            // ID
            tr.innerHTML = `<td><div class="id-cell">${id}</div></td>`;

            // Name
            const nameTd = document.createElement('td');
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = activity.name;
            nameInput.placeholder = 'Activity name';
            nameInput.addEventListener('input', e => { activity.name = e.target.value; });
            nameTd.appendChild(nameInput);
            tr.appendChild(nameTd);

            // Duration
            const durTd = document.createElement('td');
            const durInput = document.createElement('input');
            durInput.type = 'number';
            durInput.min = '0';
            durInput.step = 'any';
            durInput.value = activity.duration || '';
            durInput.addEventListener('input', e => {
                activity.duration = e.target.value ? parseFloat(e.target.value) : '';
            });
            durTd.appendChild(durInput);
            tr.appendChild(durTd);

            // Dependencies
            const depsTd = document.createElement('td');
            const depsContainer = document.createElement('div');
            depsContainer.classList.add('deps-container');

            activity.dependencies.forEach(depId => {
                const tag = document.createElement('span');
                tag.classList.add('dep-tag');
                tag.innerHTML = `${depId}<span class="remove-dep" data-dep="${depId}">×</span>`;
                tag.querySelector('.remove-dep').addEventListener('click', () => {
                    activity.dependencies = activity.dependencies.filter(d => d !== depId);
                    renderTable();
                });
                depsContainer.appendChild(tag);
            });

            // Add dependency button
            const availableDeps = activities
                .map((_, idx) => generateId(idx))
                .filter(aid => aid !== id && !activity.dependencies.includes(aid));

            if (availableDeps.length > 0) {
                const addDepBtn = document.createElement('button');
                addDepBtn.classList.add('add-dep-btn');
                addDepBtn.textContent = '+';
                addDepBtn.addEventListener('click', () => {
                    // Replace button with select
                    const select = document.createElement('select');
                    select.classList.add('dep-select');
                    const placeholder = document.createElement('option');
                    placeholder.value = '';
                    placeholder.textContent = '...';
                    select.appendChild(placeholder);
                    availableDeps.forEach(aid => {
                        const opt = document.createElement('option');
                        opt.value = aid;
                        opt.textContent = `${aid} - ${activities[activities.map((_, idx) => generateId(idx)).indexOf(aid)]?.name || ''}`;
                        select.appendChild(opt);
                    });
                    addDepBtn.replaceWith(select);
                    select.focus();
                    select.addEventListener('change', () => {
                        if (select.value) {
                            activity.dependencies.push(select.value);
                        }
                        renderTable();
                    });
                    select.addEventListener('blur', () => renderTable());
                });
                depsContainer.appendChild(addDepBtn);
            }

            if (activity.dependencies.length === 0 && availableDeps.length === 0) {
                depsContainer.innerHTML = '<span style="color:#999">None</span>';
            }

            depsTd.appendChild(depsContainer);
            tr.appendChild(depsTd);

            // Delete
            const delTd = document.createElement('td');
            const delBtn = document.createElement('button');
            delBtn.classList.add('delete-btn');
            delBtn.textContent = '×';
            delBtn.addEventListener('click', () => removeActivity(i));
            delTd.appendChild(delBtn);
            tr.appendChild(delTd);

            activityBody.appendChild(tr);
        });
    }

    // --- CPM Algorithm ---
    function calculate() {
        // Validate
        if (activities.length === 0) {
            showError('Add at least one activity before calculating.');
            return;
        }

        for (let i = 0; i < activities.length; i++) {
            const a = activities[i];
            const id = generateId(i);
            if (!a.name.trim()) {
                showError(`Activity ${id} needs a name.`);
                return;
            }
            const dur = typeof a.duration === 'number' ? a.duration : parseFloat(a.duration);
            if (isNaN(dur) || dur <= 0) {
                showError(`Activity ${id} needs a valid duration.`);
                return;
            }
        }

        // Check for circular dependencies
        if (hasCycle()) {
            showError('Circular dependency detected. Please check your dependencies.');
            return;
        }

        // Build activity map
        const nodes = activities.map((a, i) => ({
            id: generateId(i),
            name: a.name,
            duration: typeof a.duration === 'number' ? a.duration : parseFloat(a.duration),
            dependencies: [...a.dependencies],
            es: 0, ef: 0, ls: 0, lf: 0, tf: 0, ff: 0,
            critical: false
        }));

        const nodeMap = {};
        nodes.forEach(n => { nodeMap[n.id] = n; });

        // Topological sort
        const sorted = topologicalSort(nodes, nodeMap);

        // Forward pass
        sorted.forEach(node => {
            if (node.dependencies.length === 0) {
                node.es = 0;
            } else {
                node.es = Math.max(...node.dependencies.map(d => nodeMap[d].ef));
            }
            node.ef = node.es + node.duration;
        });

        // Project duration
        const projectDuration = Math.max(...nodes.map(n => n.ef));

        // Backward pass
        const reversed = [...sorted].reverse();
        reversed.forEach(node => {
            // Find successors
            const successors = nodes.filter(n => n.dependencies.includes(node.id));
            if (successors.length === 0) {
                node.lf = projectDuration;
            } else {
                node.lf = Math.min(...successors.map(s => s.ls));
            }
            node.ls = node.lf - node.duration;
        });

        // Float calculations
        nodes.forEach(node => {
            node.tf = node.ls - node.es;
            // Free float: min ES of successors - EF of this node
            const successors = nodes.filter(n => n.dependencies.includes(node.id));
            if (successors.length === 0) {
                node.ff = 0;
            } else {
                node.ff = Math.min(...successors.map(s => s.es)) - node.ef;
            }
            node.critical = Math.abs(node.tf) < 0.0001;
        });

        results = { nodes, projectDuration, sorted };
        renderResults();
    }

    function hasCycle() {
        const ids = activities.map((_, i) => generateId(i));
        const visited = new Set();
        const stack = new Set();

        function dfs(id) {
            if (stack.has(id)) return true;
            if (visited.has(id)) return false;
            visited.add(id);
            stack.add(id);
            const idx = ids.indexOf(id);
            if (idx >= 0) {
                for (const dep of activities[idx].dependencies) {
                    if (dfs(dep)) return true;
                }
            }
            stack.delete(id);
            return false;
        }

        for (const id of ids) {
            if (dfs(id)) return true;
        }
        return false;
    }

    function topologicalSort(nodes, nodeMap) {
        const sorted = [];
        const visited = new Set();

        function visit(node) {
            if (visited.has(node.id)) return;
            visited.add(node.id);
            node.dependencies.forEach(depId => {
                if (nodeMap[depId]) visit(nodeMap[depId]);
            });
            sorted.push(node);
        }

        nodes.forEach(n => visit(n));
        return sorted;
    }

    // --- Results rendering ---
    function renderResults() {
        resultsSection.style.display = '';
        resultsBody.innerHTML = '';

        const { nodes, projectDuration } = results;
        const criticalPath = nodes.filter(n => n.critical).map(n => n.id);
        const nonCritical = nodes.filter(n => !n.critical);

        nodes.forEach(node => {
            const tr = document.createElement('tr');
            if (node.critical) tr.classList.add('critical-row');

            const round = v => Math.round(v * 10) / 10;

            tr.innerHTML = `
                <td>${node.id}${node.critical ? '<span class="critical-badge">Critical</span>' : ''}</td>
                <td>${round(node.duration)}</td>
                <td>${round(node.es)}</td>
                <td>${round(node.ef)}</td>
                <td>${round(node.ls)}</td>
                <td>${round(node.lf)}</td>
                <td class="${node.critical ? 'float-zero' : ''}">${round(node.tf)}</td>
                <td class="${node.critical ? 'float-zero' : ''}">${round(node.ff)}</td>
            `;
            resultsBody.appendChild(tr);
        });

        // Summary
        const critPath = getCriticalPathSequence(nodes);
        let html = `<strong>Critical Path:</strong> ${critPath.join(' → ')}<br>`;
        html += `<strong>Project Duration:</strong> ${Math.round(projectDuration * 10) / 10} units<br>`;
        if (nonCritical.length > 0) {
            html += `<strong>Non-critical activities:</strong> ${nonCritical.map(n =>
                `${n.id} (float: ${Math.round(n.tf * 10) / 10})`
            ).join(', ')}`;
        }
        summaryBox.innerHTML = html;
    }

    function getCriticalPathSequence(nodes) {
        // Build the longest critical chain following dependencies
        const critical = nodes.filter(n => n.critical);
        const starts = critical.filter(n => n.dependencies.length === 0 || !n.dependencies.some(d => critical.find(c => c.id === d)));
        const path = [];

        function walk(node) {
            path.push(node.id);
            const successors = critical.filter(n => n.dependencies.includes(node.id));
            if (successors.length > 0) {
                // Pick the one with earliest ES (should only be one on critical path)
                successors.sort((a, b) => a.es - b.es);
                walk(successors[0]);
            }
        }

        if (starts.length > 0) walk(starts[0]);
        return path;
    }

    // --- Toast ---
    function showError(msg) {
        toast.textContent = msg;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 3000);
    }

    // --- Event listeners ---
    addBtn.addEventListener('click', addActivity);
    calcBtn.addEventListener('click', calculate);

    // --- Initialise with sample data ---
    activities = [
        { name: 'Requirements Gathering', duration: 3, dependencies: [] },
        { name: 'UI Design', duration: 4, dependencies: ['A'] },
        { name: 'Database Design', duration: 5, dependencies: ['A'] },
        { name: 'Backend Development', duration: 7, dependencies: ['B', 'C'] },
        { name: 'Testing', duration: 3, dependencies: ['D'] }
    ];

    renderTable();
})();
