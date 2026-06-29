(function () {
    'use strict';

    // --- State ---
    let activities = [];
    let results = null;

    // --- DOM refs ---
    const activityBody = document.getElementById('activity-body');
    const addBtn = document.getElementById('add-activity-btn');
    const calcBtn = document.getElementById('calculate-btn');

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

            // Dependencies (placeholder)
            const depsTd = document.createElement('td');
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

    // --- Event listeners ---
    addBtn.addEventListener('click', addActivity);

    renderTable();
})();
