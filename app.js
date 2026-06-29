(function () {
    'use strict';

    // --- State ---
    let activities = [];
    let results = null;

    // --- DOM refs ---
    const activityBody = document.getElementById('activity-body');
    const addBtn = document.getElementById('add-activity-btn');
    const calcBtn = document.getElementById('calculate-btn');
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

    // --- Toast ---
    function showError(msg) {
        toast.textContent = msg;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 3000);
    }

    // --- Event listeners ---
    addBtn.addEventListener('click', addActivity);

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
