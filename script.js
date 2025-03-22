document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('taskForm');
    const taskList = document.getElementById('taskList');
    const pendingList = document.getElementById('pendingList');
    const completedList = document.getElementById('completedList');
    const voiceInputBtn = document.getElementById('voiceInput');
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let completedTasks = JSON.parse(localStorage.getItem('completedTasks')) || [];
    let editingIndex = null;

    // Initialize missing fields
    tasks = tasks.map(task => ({
        ...task,
        totalPauseTime: task.totalPauseTime || 0,
        pauseCount: task.pauseCount || 0,
        pauseStart: task.pauseStart || null
    }));

    // Load tasks
    renderTasks();

    // Add new task
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addTask();
    });

    // Voice input
    voiceInputBtn.addEventListener('click', () => {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'en-US';
        recognition.start();
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            const parts = transcript.split(' ');
            const taskName = parts.slice(0, -3).join(' ');
            const category = parts[parts.length - 3];
            const time = parseInt(parts[parts.length - 2]) || 5;
            document.getElementById('taskName').value = taskName;
            document.getElementById('category').value = category;
            document.getElementById('estimatedTime').value = time;
            addTask();
        };
        recognition.onerror = (event) => console.error('Speech recognition error:', event.error);
    });

    function addTask() {
        const taskName = document.getElementById('taskName').value;
        const category = document.getElementById('category').value;
        const estimatedTime = parseInt(document.getElementById('estimatedTime').value) * 60;
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
    }

    function renderTasks() {
        taskList.innerHTML = '';
        pendingList.innerHTML = '<table class="spreadsheet"><tr><th>Name</th><th>Category</th><th>Priority</th><th>Action</th></tr></table>';
        completedList.innerHTML = '<table class="spreadsheet"><tr><th>Name</th><th>Category</th><th>Start</th><th>End</th><th>Paused</th><th>Action</th></tr></table>';

        const activeTasks = tasks.filter(task => task.status !== 'Completed').sort((a, b) => a.priority - b.priority);
        const pendingTasks = tasks.filter(task => task.status === 'Pending');

        activeTasks.forEach((task, index) => renderTask(task, index, taskList));
        pendingTasks.forEach(task => renderPendingTask(task));
        completedTasks.forEach((task, index) => renderCompletedTask(task, index));
    }

    function renderTask(task, index, container) {
        const taskDiv = document.createElement('div');
        const categoryClass = getCategoryClass(task.category);
        taskDiv.className = `task ${categoryClass} ${task.status === 'Completed' ? 'completed' : ''}`;

        const startDate = new Date(task.startTime);
        const sendTime = new Date(startDate.getTime() + task.estimatedTime * 1000);
        let timeLeft = task.estimatedTime - task.timeSoFar;
        if (timeLeft < 0) timeLeft = 0;
        const endTime = task.status === 'In Progress' ? new Date(Date.now() + timeLeft * 1000) : sendTime;
        const pauseMinutes = Math.floor(task.totalPauseTime / 60);
        const pauseSeconds = task.totalPauseTime % 60;
        const formattedPauseTime = `${pauseMinutes}:${pauseSeconds < 10 ? '0' : ''}${pauseSeconds}`;
        const priorityLabel = { 1: 'Urgent', 2: 'Important', 3: 'Can Wait', 4: 'Planned' }[task.priority];

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
                <button class="move-pending" onclick="moveToPending(${index})">Move to Pending</button>
                <button class="restart" onclick="restartTask(${index})">Restart</button>
                <button class="edit" onclick="editTask(${index})">Edit</button>
                <input type="number" id="extendTime${index}" placeholder="Extend (min)" min="1">
                <button class="extend" onclick="extendTime(${index})">Extend Time</button>
            `;
        }
        container.appendChild(taskDiv);
    }

    function renderPendingTask(task) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.name}</td>
            <td>${task.category}</td>
            <td>${task.priority}</td>
            <td><button class="move" onclick="moveToMain(${tasks.indexOf(task)})">Move to Main</button></td>
        `;
        pendingList.querySelector('table').appendChild(row);
    }

    function renderCompletedTask(task, index) {
        const row = document.createElement('tr');
        const startDate = new Date(task.startTime);
        const endDate = new Date(task.endTime || Date.now());
        const pauseMinutes = Math.floor(task.totalPauseTime / 60);
        const pauseSeconds = task.totalPauseTime % 60;
        const formattedPauseTime = `${pauseMinutes}:${pauseSeconds < 10 ? '0' : ''}${pauseSeconds}`;
        row.innerHTML = `
            <td>${task.name}</td>
            <td>${task.category}</td>
            <td>${startDate.toLocaleString()}</td>
            <td>${endDate.toLocaleString()}</td>
            <td>${formattedPauseTime} (${task.pauseCount} times)</td>
            <td>
                <button class="next" onclick="nextTask(${index})">Next Task</button>
                <button class="delete" onclick="deleteTask(${index})">Delete</button>
            </td>
        `;
        completedList.querySelector('table').appendChild(row);
    }

    function getCategoryClass(category) {
        const normalizedCategory = category.toLowerCase();
        return {
            'work': 'category-work',
            'personal': 'category-personal',
            'urgent': 'category-urgent',
            'learning': 'category-learning'
        }[normalizedCategory] || 'category-default';
    }

    window.startTask = function(index) {
        if (tasks[index].status === 'Pending' || tasks[index].status === 'Paused') {
            tasks[index].status = 'In Progress';
            if (tasks[index].status === 'Pending') {
                tasks[index].startTime = new Date().toISOString();
            } else {
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
                tasks[index].totalPauseTime
