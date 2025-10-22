document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('taskForm');
    const taskList = document.getElementById('taskList');
    const pendingList = document.getElementById('pendingList');
    const completedList = document.getElementById('completedList');
    const voiceInputBtn = document.getElementById('voiceInput');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const helpToggle = document.getElementById('helpToggle');
    const helpModal = document.getElementById('helpModal');
    const helpClose = document.getElementById('helpClose');
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let completedTasks = JSON.parse(localStorage.getItem('completedTasks')) || [];
    let editingIndex = null;

    // Dark mode toggle
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }

    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark);
        darkModeToggle.textContent = isDark ? '☀️' : '🌙';
    });

    // Help modal
    helpToggle.addEventListener('click', () => {
        helpModal.classList.add('show');
    });

    helpClose.addEventListener('click', () => {
        helpModal.classList.remove('show');
    });

    window.addEventListener('click', (event) => {
        if (event.target === helpModal) {
            helpModal.classList.remove('show');
        }
    });

    // Initialize missing fields
    tasks = tasks.map(task => ({
        ...task,
        totalPauseTime: task.totalPauseTime || 0,
        pauseCount: task.pauseCount || 0,
        pauseStart: task.pauseStart || null,
        dueDate: task.dueDate || null,
        tags: task.tags || [],
        notes: task.notes || ''
    }));

    // Load tasks
    renderTasks();
    updateDashboard();
    updateFilterOptions();

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const filterPriority = document.getElementById('filterPriority');
    const filterCategory = document.getElementById('filterCategory');

    searchInput.addEventListener('input', renderTasks);
    filterPriority.addEventListener('change', renderTasks);
    filterCategory.addEventListener('change', renderTasks);

    // Export functionality
    const exportBtn = document.getElementById('exportBtn');
    exportBtn.addEventListener('click', exportTasks);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + N: Focus on task name input
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            document.getElementById('taskName').focus();
        }
        // Ctrl/Cmd + F: Focus on search input
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
        // Ctrl/Cmd + E: Export tasks
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            exportTasks();
        }
        // Ctrl/Cmd + D: Toggle dark mode
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            darkModeToggle.click();
        }
    });

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
        const dueDate = document.getElementById('dueDate').value;
        const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t);
        const notes = document.getElementById('notes').value;
        const startTime = new Date().toISOString();
        const task = {
            name: taskName,
            category,
            startTime,
            estimatedTime,
            priority,
            dueDate: dueDate || null,
            tags: tags || [],
            notes: notes || '',
            status: 'Pending',
            timeSoFar: 0,
            totalPauseTime: 0,
            pauseCount: 0,
            pauseStart: null
        };
        tasks.push(task);
        saveTasks();
        renderTasks();
        updateDashboard();
        updateFilterOptions();
        taskForm.reset();
    }

    function renderTasks() {
        taskList.innerHTML = '';
        pendingList.innerHTML = '<table class="spreadsheet"><tr><th>Name</th><th>Category</th><th>Priority</th><th>Action</th></tr></table>';
        completedList.innerHTML = '<table class="spreadsheet"><tr><th>Name</th><th>Category</th><th>Start</th><th>End</th><th>Paused</th><th>Action</th></tr></table>';

        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const filterPriorityValue = document.getElementById('filterPriority').value;
        const filterCategoryValue = document.getElementById('filterCategory').value;

        let activeTasks = tasks.filter(task => {
            if (task.status === 'Completed') return false;
            if (searchTerm && !task.name.toLowerCase().includes(searchTerm) && 
                !task.category.toLowerCase().includes(searchTerm) &&
                !task.tags.some(tag => tag.toLowerCase().includes(searchTerm))) return false;
            if (filterPriorityValue && task.priority !== parseInt(filterPriorityValue)) return false;
            if (filterCategoryValue && task.category !== filterCategoryValue) return false;
            return true;
        }).sort((a, b) => a.priority - b.priority);

        const pendingTasks = tasks.filter(task => task.status === 'Pending');

        activeTasks.forEach((task, index) => {
            const originalIndex = tasks.indexOf(task);
            renderTask(task, originalIndex, taskList);
        });
        pendingTasks.forEach(task => renderPendingTask(task));
        completedTasks.forEach((task, index) => renderCompletedTask(task, index));
        
        checkDueDates();
    }

    function renderTask(task, index, container) {
        const taskDiv = document.createElement('div');
        const categoryClass = getCategoryClass(task.category);
        taskDiv.className = `task ${categoryClass} priority-${task.priority} ${task.status === 'Completed' ? 'completed' : ''}`;

        const startDate = new Date(task.startTime);
        const sendTime = new Date(startDate.getTime() + task.estimatedTime * 1000);
        let timeLeft = task.estimatedTime - task.timeSoFar;
        if (timeLeft < 0) timeLeft = 0;
        const endTime = task.status === 'In Progress' ? new Date(Date.now() + timeLeft * 1000) : sendTime;
        const pauseMinutes = Math.floor(task.totalPauseTime / 60);
        const pauseSeconds = task.totalPauseTime % 60;
        const formattedPauseTime = `${pauseMinutes}:${pauseSeconds < 10 ? '0' : ''}${pauseSeconds}`;
        const priorityLabel = { 1: 'Urgent', 2: 'Important', 3: 'Can Wait', 4: 'Planned' }[task.priority];
        
        const dueDateStr = task.dueDate ? `<br>Due: <span class="due-date ${isDueSoon(task.dueDate) ? 'due-soon' : ''} ${isOverdue(task.dueDate) ? 'overdue' : ''}">${new Date(task.dueDate).toLocaleString()}</span>` : '';
        const tagsStr = task.tags && task.tags.length > 0 ? `<br>Tags: ${task.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ')}` : '';
        const notesStr = task.notes ? `<br>Notes: <span class="notes">${task.notes}</span>` : '';
        
        // Calculate progress percentage
        const progressPercent = task.estimatedTime > 0 ? Math.min((task.timeSoFar / task.estimatedTime) * 100, 100) : 0;

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
                Est. Time: ${task.estimatedTime / 60} min | Send Time: <span id="sendTime${index}">${sendTime.toLocaleString()}</span>${dueDateStr}${tagsStr}${notesStr}<br>
                <div class="task-progress">
                    <div class="task-progress-bar" id="progressBar${index}" style="width: ${progressPercent}%"></div>
                </div>
                Status: ${task.status} | Time So Far: <span id="timeSoFar${index}">${Math.floor(task.timeSoFar / 60)}:${task.timeSoFar % 60 < 10 ? '0' : ''}${task.timeSoFar % 60}</span><br>
                <div class="time-left">
                    Time Left: <span id="timeLeft${index}">${Math.floor(timeLeft / 60)}:${timeLeft % 60 < 10 ? '0' : ''}${timeLeft % 60}</span> 
                    <span class="clock-icon">⌛</span> 
                    <span class="end-label">End:</span> <span id="endTime${index}">${endTime.toLocaleString()}</span>
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
                tasks[index].totalPauseTime += pauseDuration;
                tasks[index].pauseStart = null;
            }
            tasks[index].startTime = new Date(Date.now() - tasks[index].timeSoFar * 1000).toISOString();
        }
        saveTasks();
        renderTasks();
    };

    window.completeTask = function(index) {
        if (tasks[index].status === 'In Progress' || tasks[index].status === 'Paused') {
            if (tasks[index].status === 'Paused' && tasks[index].pauseStart) {
                const pauseEnd = new Date();
                const pauseDuration = Math.floor((pauseEnd - new Date(tasks[index].pauseStart)) / 1000);
                tasks[index].totalPauseTime += pauseDuration;
                tasks[index].pauseStart = null;
            }
            tasks[index].status = 'Completed';
            tasks[index].endTime = new Date().toISOString();
            completedTasks.push(tasks[index]);
            tasks.splice(index, 1);
            saveTasks();
            renderTasks();
            updateDashboard();
        }
    };

    window.moveToPending = function(index) {
        if (tasks[index].status !== 'Pending') {
            tasks[index].status = 'Pending';
            tasks[index].timeSoFar = 0;
            tasks[index].totalPauseTime = 0;
            tasks[index].pauseCount = 0;
            tasks[index].pauseStart = null;
            saveTasks();
            renderTasks();
        }
    };

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

    window.editTask = function(index) {
        editingIndex = index;
        renderTasks();
    };

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

    window.extendTime = function(index) {
        const extendInput = document.getElementById(`extendTime${index}`);
        const additionalTime = parseInt(extendInput.value) * 60;
        if (additionalTime > 0) {
            tasks[index].estimatedTime += additionalTime;
            saveTasks();
            renderTasks();
        }
        extendInput.value = '';
    };

    window.nextTask = function(index) {
        const completedTask = completedTasks[index];
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

    window.deleteTask = function(index) {
        completedTasks.splice(index, 1);
        saveTasks();
        renderTasks();
    };

    window.moveToMain = function(index) {
        tasks[index].status = 'In Progress';
        tasks[index].startTime = new Date().toISOString();
        saveTasks();
        renderTasks();
    };

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
                const progressBar = document.getElementById(`progressBar${index}`);

                if (timeSoFarSpan) timeSoFarSpan.textContent = `${Math.floor(task.timeSoFar / 60)}:${task.timeSoFar % 60 < 10 ? '0' : ''}${task.timeSoFar % 60}`;
                if (timeLeftSpan) timeLeftSpan.textContent = `${Math.floor(timeLeft / 60)}:${timeLeft % 60 < 10 ? '0' : ''}${timeLeft % 60}`;
                if (sendTimeSpan) sendTimeSpan.textContent = new Date(start.getTime() + task.estimatedTime * 1000).toLocaleString();
                if (endTimeSpan) endTimeSpan.textContent = endTime.toLocaleString();
                
                // Update progress bar
                if (progressBar && task.estimatedTime > 0) {
                    const progressPercent = Math.min((task.timeSoFar / task.estimatedTime) * 100, 100);
                    progressBar.style.width = progressPercent + '%';
                }
            }
        });
        saveTasks();
    }, 1000);

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
    }

    function updateDashboard() {
        const today = new Date().toDateString();
        const completedToday = completedTasks.filter(task => 
            new Date(task.endTime).toDateString() === today
        ).length;
        
        const timeToday = completedTasks
            .filter(task => new Date(task.endTime).toDateString() === today)
            .reduce((total, task) => total + (task.timeSoFar || 0), 0);
        
        const active = tasks.filter(task => task.status !== 'Completed').length;
        
        document.getElementById('tasksToday').textContent = completedToday;
        document.getElementById('timeTracked').textContent = Math.floor(timeToday / 60) + 'm';
        document.getElementById('activeTasks').textContent = active;
    }

    function updateFilterOptions() {
        const categories = [...new Set(tasks.map(task => task.category))];
        const filterCategory = document.getElementById('filterCategory');
        const currentValue = filterCategory.value;
        
        filterCategory.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            if (cat === currentValue) option.selected = true;
            filterCategory.appendChild(option);
        });
    }

    function isDueSoon(dueDate) {
        if (!dueDate) return false;
        const due = new Date(dueDate);
        const now = new Date();
        const hoursDiff = (due - now) / (1000 * 60 * 60);
        return hoursDiff > 0 && hoursDiff <= 24;
    }

    function isOverdue(dueDate) {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date();
    }

    function checkDueDates() {
        tasks.forEach(task => {
            if (task.dueDate && task.status !== 'Completed') {
                if (isOverdue(task.dueDate)) {
                    if (!task.overdueNotified) {
                        task.overdueNotified = true;
                        saveTasks();
                    }
                } else if (isDueSoon(task.dueDate)) {
                    if (!task.dueSoonNotified) {
                        task.dueSoonNotified = true;
                        saveTasks();
                    }
                }
            }
        });
    }

    function exportTasks() {
        const exportData = {
            tasks: tasks,
            completedTasks: completedTasks,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tasks-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }
});
