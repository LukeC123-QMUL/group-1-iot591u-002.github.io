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
    const diagramSection = document.getElementById('diagram-section');
    const diagramArea = document.getElementById('diagram-area');
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
        renderDiagram();
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
        diagramSection.style.display = '';
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

    // --- Diagram rendering ---
    function renderDiagram() {
        const { nodes } = results;
        const svg = buildDiagramSVG(nodes);
        diagramArea.innerHTML = '';
        diagramArea.appendChild(svg);
    }

    function buildDiagramSVG(nodes) {
        // Assign layers (x-position based on longest path from start)
        const layers = {};
        const nodeMap = {};
        nodes.forEach(n => { nodeMap[n.id] = n; });

        function getLayer(node) {
            if (layers[node.id] !== undefined) return layers[node.id];
            if (node.dependencies.length === 0) {
                layers[node.id] = 0;
                return 0;
            }
            const maxDepLayer = Math.max(...node.dependencies.map(d => getLayer(nodeMap[d])));
            layers[node.id] = maxDepLayer + 1;
            return layers[node.id];
        }

        nodes.forEach(n => getLayer(n));

        // Group by layer
        const layerGroups = {};
        nodes.forEach(n => {
            const l = layers[n.id];
            if (!layerGroups[l]) layerGroups[l] = [];
            layerGroups[l].push(n);
        });

        const numLayers = Math.max(...Object.keys(layerGroups).map(Number)) + 1;
        const nodeWidth = 140;
        const nodeHeight = 100;
        const hGap = 80;
        const vGap = 40;

        // Calculate positions
        const positions = {};
        const maxNodesInLayer = Math.max(...Object.values(layerGroups).map(g => g.length));
        const totalHeight = maxNodesInLayer * (nodeHeight + vGap) - vGap;
        const totalWidth = numLayers * (nodeWidth + hGap) - hGap;

        Object.entries(layerGroups).forEach(([layer, group]) => {
            const l = Number(layer);
            const groupHeight = group.length * (nodeHeight + vGap) - vGap;
            const startY = (totalHeight - groupHeight) / 2;
            group.forEach((node, idx) => {
                positions[node.id] = {
                    x: l * (nodeWidth + hGap) + 20,
                    y: startY + idx * (nodeHeight + vGap) + 20
                };
            });
        });

        const svgWidth = totalWidth + 60;
        const svgHeight = totalHeight + 60;

        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.width = '100%';
        svg.style.height = `${Math.max(svgHeight, 300)}px`;

        // Defs for arrowheads
        const defs = document.createElementNS(ns, 'defs');
        defs.innerHTML = `
            <marker id="ah-crit" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#bd2404"/>
            </marker>
            <marker id="ah-norm" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#007207"/>
            </marker>
        `;
        svg.appendChild(defs);

        // Draw arrows first (behind nodes)
        nodes.forEach(node => {
            node.dependencies.forEach(depId => {
                const from = positions[depId];
                const to = positions[node.id];
                const isCritEdge = node.critical && nodeMap[depId].critical;

                const startX = from.x + nodeWidth;
                const startY = from.y + nodeHeight / 2;
                const endX = to.x;
                const endY = to.y + nodeHeight / 2;

                const midX = (startX + endX) / 2;

                const path = document.createElementNS(ns, 'path');
                path.setAttribute('d', `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', isCritEdge ? '#bd2404' : '#007207');
                path.setAttribute('stroke-width', isCritEdge ? '2.5' : '1.5');
                path.setAttribute('marker-end', isCritEdge ? 'url(#ah-crit)' : 'url(#ah-norm)');
                svg.appendChild(path);
            });
        });

        // Draw nodes
        nodes.forEach(node => {
            const pos = positions[node.id];
            const g = document.createElementNS(ns, 'g');
            const round = v => Math.round(v * 10) / 10;

            const isCrit = node.critical;
            const borderColor = isCrit ? '#bd2404' : '#007207';
            const headerFill = isCrit ? 'rgba(189,36,4,0.2)' : 'rgba(0,114,7,0.2)';
            const textColor = isCrit ? '#e84c2b' : '#2db84d';

            // Background
            const bg = document.createElementNS(ns, 'rect');
            bg.setAttribute('x', pos.x); bg.setAttribute('y', pos.y);
            bg.setAttribute('width', nodeWidth); bg.setAttribute('height', nodeHeight);
            bg.setAttribute('rx', '6'); bg.setAttribute('fill', '#ffffff');
            g.appendChild(bg);

            // Header (flat bottom corners)
            const header = document.createElementNS(ns, 'path');
            const hx = pos.x; const hy = pos.y;
            header.setAttribute('d', `M${hx+6},${hy} h${nodeWidth-12} a6,6 0 0 1 6,6 v20 h-${nodeWidth} v-20 a6,6 0 0 1 6,-6 z`);
            header.setAttribute('fill', headerFill);
            g.appendChild(header);

            // Header separator
            const sep = document.createElementNS(ns, 'line');
            sep.setAttribute('x1', hx+1); sep.setAttribute('y1', hy+26);
            sep.setAttribute('x2', hx+nodeWidth-1); sep.setAttribute('y2', hy+26);
            sep.setAttribute('stroke', '#e0e0e0'); sep.setAttribute('stroke-width', '1');
            g.appendChild(sep);

            // Header text (ID label)
            const headerText = document.createElementNS(ns, 'text');
            headerText.setAttribute('x', hx + nodeWidth/2); headerText.setAttribute('y', hy + 17);
            headerText.setAttribute('text-anchor', 'middle'); headerText.setAttribute('font-size', '11');
            headerText.setAttribute('font-weight', '700'); headerText.setAttribute('fill', textColor);
            headerText.setAttribute('font-family', '-apple-system, sans-serif');
            headerText.setAttribute('class', 'node-label');
            headerText.textContent = node.id;
            g.appendChild(headerText);

            // Header text (name, hidden by default, shown on hover)
            const nameText = document.createElementNS(ns, 'text');
            nameText.setAttribute('x', hx + nodeWidth/2); nameText.setAttribute('y', hy + 17);
            nameText.setAttribute('text-anchor', 'middle'); nameText.setAttribute('font-size', '8');
            nameText.setAttribute('font-weight', '600'); nameText.setAttribute('fill', textColor);
            nameText.setAttribute('font-family', '-apple-system, sans-serif');
            nameText.setAttribute('class', 'node-name');
            nameText.style.display = 'none';
            nameText.textContent = node.name;
            g.appendChild(nameText);

            // Hover behaviour
            g.style.cursor = 'default';
            g.addEventListener('mouseenter', () => {
                headerText.style.display = 'none';
                nameText.style.display = '';
            });
            g.addEventListener('mouseleave', () => {
                headerText.style.display = '';
                nameText.style.display = 'none';
            });

            // Grid lines
            const midX = hx + nodeWidth / 2;
            [[hx+1, hy+26, midX-1, hy+26+18], [hx+1, hy+26+18, hx+nodeWidth-1, hy+26+18],
             [midX, hy+26, midX, hy+26+36], [hx+1, hy+26+36, hx+nodeWidth-1, hy+26+36]].forEach(([x1,y1,x2,y2], idx) => {
                if (idx === 0) return; // skip first, it's for the vertical
                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', x1); line.setAttribute('y1', y1);
                line.setAttribute('x2', x2); line.setAttribute('y2', y2);
                line.setAttribute('stroke', '#e0e0e0'); line.setAttribute('stroke-width', '1');
                g.appendChild(line);
            });
            // Vertical divider
            const vLine = document.createElementNS(ns, 'line');
            vLine.setAttribute('x1', midX); vLine.setAttribute('y1', hy+26);
            vLine.setAttribute('x2', midX); vLine.setAttribute('y2', hy+62);
            vLine.setAttribute('stroke', '#e0e0e0'); vLine.setAttribute('stroke-width', '1');
            g.appendChild(vLine);

            // Data
            const dataY1 = hy + 40;
            const dataY2 = hy + 56;
            const leftX = hx + 8;
            const rightX = midX + 8;

            [['ES', round(node.es), leftX, dataY1], ['EF', round(node.ef), rightX, dataY1],
             ['LS', round(node.ls), leftX, dataY2], ['LF', round(node.lf), rightX, dataY2]].forEach(([label, val, x, y]) => {
                const lbl = document.createElementNS(ns, 'text');
                lbl.setAttribute('x', x); lbl.setAttribute('y', y);
                lbl.setAttribute('font-size', '8'); lbl.setAttribute('fill', '#666666');
                lbl.setAttribute('font-family', '-apple-system, sans-serif');
                lbl.textContent = label;
                g.appendChild(lbl);

                const valText = document.createElementNS(ns, 'text');
                valText.setAttribute('x', x + 18); valText.setAttribute('y', y);
                valText.setAttribute('font-size', '9'); valText.setAttribute('font-weight', '600');
                valText.setAttribute('fill', '#161616');
                valText.setAttribute('font-family', '-apple-system, sans-serif');
                valText.textContent = val;
                g.appendChild(valText);
            });

            // Duration row background
            const durBg = document.createElementNS(ns, 'rect');
            durBg.setAttribute('x', hx+1); durBg.setAttribute('y', hy+62);
            durBg.setAttribute('width', nodeWidth-2); durBg.setAttribute('height', nodeHeight-62-1);
            durBg.setAttribute('fill', '#f8f8f8');
            g.appendChild(durBg);

            // Duration text
            const durText = document.createElementNS(ns, 'text');
            durText.setAttribute('x', hx + nodeWidth/2); durText.setAttribute('y', hy + 82);
            durText.setAttribute('text-anchor', 'middle'); durText.setAttribute('font-size', '10');
            durText.setAttribute('font-weight', '600'); durText.setAttribute('fill', '#161616');
            durText.setAttribute('font-family', '-apple-system, sans-serif');
            durText.textContent = `Dur: ${round(node.duration)}`;
            g.appendChild(durText);

            // Border (on top)
            const border = document.createElementNS(ns, 'rect');
            border.setAttribute('x', pos.x); border.setAttribute('y', pos.y);
            border.setAttribute('width', nodeWidth); border.setAttribute('height', nodeHeight);
            border.setAttribute('rx', '6'); border.setAttribute('fill', 'none');
            border.setAttribute('stroke', borderColor); border.setAttribute('stroke-width', '2');
            g.appendChild(border);

            svg.appendChild(g);
        });

        return svg;
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
