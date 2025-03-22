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
        const priorityLabel = { 1: 'Urgent', 2: 'Important', 3: 'Can Wait', 4: 'Planned' }[
