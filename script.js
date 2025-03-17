document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('taskForm');
    const taskList = document.getElementById('taskList');
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let editingIndex = null;

    // Initialize missing fields for existing tasks
    tasks = tasks.map(task => ({
        ...task,
        totalPauseTime: task.totalPauseTime || 0,
        pauseCount: task.pauseCount || 0,
        pauseStart: task.pauseStart || null
    }));

    // Load existing tasks
    renderTasks();

    // Add new task
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskName = document.getElementById('taskName').value;
        const category = document.getElementById('category').value;
        const estimatedTime = parseInt(document.getElementById('estimatedTime').value) * 60; // Convert to seconds
        const priority = parseInt(document.getElementById('priority').value);
        const startTime = new Date().toISOString();
        const task = {
            name: taskName,
            category,
            startTime,
            estimatedTime,
            priority,
            status: 'Pending',
            timeSoFar: 0,
            totalPauseTime: 0,
            pauseCount: 0,
            pauseStart: null
        };
        tasks.push(task);
        saveTasks();
        renderTasks();
        taskForm.reset();
    });

    // Render tasks to the page
    function renderTasks() {
        taskList.innerHTML = '';
        const activeTasks = tasks.filter(task => task.status !== 'Completed').sort((a, b) => a.priority - b.priority);
        const completedTasks = tasks.filter(task => task.status === 'Completed');

        activeTasks.forEach((task, index) => renderTask(task, tasks.indexOf(task)));
        completedTasks.forEach((task, index) => renderTask(task, tasks.indexOf(task)));
    }

    function renderTask(task, index) {
        const taskDiv = document.createElement('div');
        const categoryClass = getCategoryClass(task.category);
        taskDiv.className = `task ${categoryClass} ${task.status === 'Completed' ? 'completed' : ''}`;

        const startDate = new Date(task.startTime);
        const sendTime = new Date(startDate.getTime() + task.estimatedTime * 1000);
        let timeLeft = task.estimatedTime - task.timeSoFar;
        if (timeLeft < 0) timeLeft = 0;
        const endTime = task.status === 'In Progress' 
            ? new Date(Date.now() + timeLeft * 1000) 
            : sendTime;

        const priorityLabel = {
            1: 'Urgent',
            2: 'Important',
            3: 'Can Wait',
            4: 'Planned'
        }[task.priority];

        // Format totalPauseTime correctly
        const pauseMinutes = Math.floor(task.totalPauseTime / 60);
        const pauseSeconds = task.totalPauseTime % 60;
        const formattedPauseTime = `${pauseMinutes}:${pauseSeconds < 10 ? '0' : ''}${pauseSeconds}`;

        if (editingIndex === index) {
            taskDiv.innerHTML = `
                <div class="edit-form">
                    <input type="text" id="editName${index}" value="${task.name}">
                    <input type="text" id="editCategory${index}" value="${task.category}">
                    <input type="number" id="editEstimatedTime${index}" value="${task.estimatedTime / 60}" min="1">
                    <select id="editPriority${index}">
                        <option value="1" ${task.priority === 1 ? 'selected' : ''}>1 - Urgent</option>
                        <option value="2" ${task.priority === 2 ? 'selected' : ''}>2 - Important</option>
                        <option value="3" ${task.priority === 3 ? 'selected' : ''}>3 - Can Wait</option>
                        <option value="4" ${task.priority === 4 ? 'selected' : ''}>4 - Planned</option>
                    </select>
                    <button class="save" onclick="saveTask(${index})">Save</button>
                </div>
            `;
        } else {
            taskDiv.innerHTML = `
                <strong>${task.name}</strong> (${task.category}) - Priority: ${task.priority} (${priorityLabel})<br>
                Start: ${startDate.toLocaleString()}<br>
                Est. Time: ${task.estimatedTime / 60} min | Send Time: <span id="sendTime${index}">${sendTime.toLocaleString()}</span><br>
                Status: ${task.status} | Time So Far: <span id="timeSoFar${index}">${Math.floor(task.timeSoFar / 60)}:${task.timeSoFar % 60 < 10 ? '0' : ''}${task.timeSoFar % 60}</span><br>
                <div class="time-left">
                    Time Left: <span id="timeLeft${index}">${Math.floor(timeLeft / 60)}:${timeLeft % 60 < 10 ? '0' : ''}${timeLeft % 60}</span> 
                    <span class="clock-icon">⌛</span> 
                    End: <span id="endTime${index}">${endTime.toLocaleString()}</span>
                </div><br>
                <button onclick="startTask(${index})" ${task.status !== 'Pending' && task.status !== 'Paused' ? 'disabled' : ''}>Start</button>
                <button class="pause" onclick="pauseTask(${index})" ${task.status !== 'In Progress' && task.status !== 'Paused' ? 'disabled' : ''}>${task.status === 'In Progress' ? 'Pause' : 'Resume'}</button>
                <button class="complete" onclick="completeTask(${index})" ${task.status === 'Completed' ? 'disabled' : ''}>Complete</button>
                <button class="restart" onclick="restartTask(${index})">Restart</button>
                <button class="edit" onclick="editTask(${index})">Edit</button>
                <input type="number" id="extendTime${index}" placeholder="Extend (min)" min="1">
                <button class="extend" onclick="extendTime(${index})">Extend Time</button>
                ${task.status === 'Completed' ? `<button class="next" onclick="nextTask(${index})">Next Task</button>` : ''}
                ${task.status === 'Completed' ? `<button class="delete" onclick="deleteTask(${index})">Delete</button>` : ''}
                ${task.status === 'Completed' ? `
                    <div class="completion-note">
                        Completed: Start: ${startDate.toLocaleString()} | End: ${new Date().toLocaleString()} | 
                        Total Paused: ${formattedPauseTime} | 
                        Paused ${task.pauseCount} time${task.pauseCount !== 1 ? 's' : ''}
                    </div>` : ''}
            `;
        }
        taskList.appendChild(taskDiv);
    }

    // Map categories to CSS classes
    function getCategoryClass(category) {
        const normalizedCategory = category.toLowerCase();
        switch (normalizedCategory) {
            case 'work':
                return 'category-work';
            case 'personal':
                return 'category-personal';
            case 'urgent':
                return 'category-urgent';
            case 'learning':
                return 'category-learning';
            default:
                return 'category-default';
        }
    }

    // Start task
    window.startTask = function(index) {
        if (tasks[index].status === 'Pending' || tasks[index].status === 'Paused') {
            tasks[index].status = 'In Progress';
            if (tasks[index].status === 'Pending') {
                tasks[index].startTime = new Date().toISOString();
            } else {
                // Resume: Adjust startTime to continue from paused point
                tasks[index].startTime = new Date(Date.now() - tasks[index].timeSoFar * 1000).toISOString();
                if (tasks[index].pauseStart) {
                    const pauseEnd = new Date();
                    const pauseDuration = Math.floor((pauseEnd - new Date(tasks[index].pauseStart)) / 1000);
                    tasks[index].totalPauseTime += pauseDuration;
                    tasks[index].pauseStart = null;
                }
            }
            saveTasks();
            renderTasks();
        }
    };

    // Pause/Resume task
    window.pauseTask = function(index) {
        if (tasks[index].status === 'In Progress') {
            tasks[index].status = 'Paused';
            tasks[index].pauseStart = new Date().toISOString();
            tasks[index].pauseCount += 1;
        } else if (tasks[index].status === 'Paused') {
            tasks[index].status = 'In Progress';
            if (tasks[index].pauseStart) {
                const pauseEnd = new Date();
                const pauseDuration = Math.floor((pauseEnd - new Date(tasks[index].pauseStart)) / 1000);
                tasks[index].totalPauseTime += pauseDuration;
                tasks[index].pauseStart = null;
            }
            tasks[index].startTime = new Date(Date.now() - tasks[index].timeSoFar * 1000).toISOString();
        }
        saveTasks();
        renderTasks();
    };

    // Complete task
    window.completeTask = function(index) {
        if (tasks[index].status === 'In Progress' || tasks[index].status === 'Paused') {
            if (tasks[index].status === 'Paused' && tasks[index].pauseStart) {
                const pauseEnd = new Date();
                const pauseDuration = Math.floor((pauseEnd - new Date(tasks[index].pauseStart)) / 1000);
                tasks[index].totalPauseTime += pauseDuration;
                tasks[index].pauseStart = null;
            }
            tasks[index].status = 'Completed';
            saveTasks();
            renderTasks();
        }
    };

    // Restart task
    window.restartTask = function(index) {
        tasks[index].startTime = new Date().toISOString();
        tasks[index].timeSoFar = 0;
        tasks[index].totalPauseTime = 0;
        tasks[index].pauseCount = 0;
        tasks[index].pauseStart = null;
        tasks[index].status = 'In Progress';
        saveTasks();
        renderTasks();
    };

    // Edit task
    window.editTask = function(index) {
        editingIndex = index;
        renderTasks();
    };

    // Save edited task
    window.saveTask = function(index) {
        const newName = document.getElementById(`editName${index}`).value;
        const newCategory = document.getElementById(`editCategory${index}`).value;
        const newEstimatedTime = parseInt(document.getElementById(`editEstimatedTime${index}`).value) * 60;
        const newPriority = parseInt(document.getElementById(`editPriority${index}`).value);

        tasks[index].name = newName;
        tasks[index].category = newCategory;
        tasks[index].estimatedTime = newEstimatedTime;
        tasks[index].priority = newPriority;

        editingIndex = null;
        saveTasks();
        renderTasks();
    };

    // Extend estimated time
    window.extendTime = function(index) {
        const extendInput = document.getElementById(`extendTime${index}`);
        const additionalTime = parseInt(extendInput.value) * 60; // Convert to seconds
        if (additionalTime > 0) {
            tasks[index].estimatedTime += additionalTime;
            saveTasks();
            renderTasks();
        }
        extendInput.value = '';
    };

    // Start a new "Next Task" from a completed task
    window.nextTask = function(index) {
        const completedTask = tasks[index];
        const newTask = {
            name: `Next: ${completedTask.name}`,
            category: completedTask.category,
            startTime: new Date().toISOString(),
            estimatedTime: completedTask.estimatedTime,
            priority: completedTask.priority,
            status: 'Pending',
            timeSoFar: 0,
            totalPauseTime: 0,
            pauseCount: 0,
            pauseStart: null
        };
        tasks.push(newTask);
        saveTasks();
        renderTasks();
    };

    // Delete a completed task
    window.deleteTask = function(index) {
        if (tasks[index].status === 'Completed') {
            tasks.splice(index, 1);
            saveTasks();
            renderTasks();
        }
    };

    // Single global timer for live updates
    setInterval(() => {
        tasks.forEach((task, index) => {
            if (task.status === 'In Progress') {
                const start = new Date(task.startTime);
                const now = new Date();
                task.timeSoFar = Math.floor((now - start) / 1000);
                let timeLeft = task.estimatedTime - task.timeSoFar;
                if (timeLeft < 0) timeLeft = 0;
                const endTime = new Date(now.getTime() + timeLeft * 1000);

                const timeSoFarSpan = document.getElementById(`timeSoFar${index}`);
                const timeLeftSpan = document.getElementById(`timeLeft${index}`);
                const sendTimeSpan = document.getElementById(`sendTime${index}`);
                const endTimeSpan = document.getElementById(`endTime${index}`);

                if (timeSoFarSpan) {
                    timeSoFarSpan.textContent = `${Math.floor(task.timeSoFar / 60)}:${task.timeSoFar % 60 < 10 ? '0' : ''}${task.timeSoFar % 60}`;
                }
                if (timeLeftSpan) {
                    timeLeftSpan.textContent = `${Math.floor(timeLeft / 60)}:${timeLeft % 60 < 10 ? '0' : ''}${timeLeft % 60}`;
                }
                if (sendTimeSpan) {
                    const sendTime = new Date(start.getTime() + task.estimatedTime * 1000);
                    sendTimeSpan.textContent = sendTime.toLocaleString();
                }
                if (endTimeSpan) {
                    endTimeSpan.textContent = endTime.toLocaleString();
                }
            }
        });
        saveTasks();
    }, 1000);

    // Save tasks to localStorage
    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }
});