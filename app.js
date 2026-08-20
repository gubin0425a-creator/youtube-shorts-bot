document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const parent = btn.closest('.panel-section, .artifacts-container');
            
            parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Settings Management
    const loadSettings = () => {
        const settings = Storage.getSettings();
        document.getElementById('keyGemini').value = settings.keyGemini || '';
    };

    const saveSettings = () => {
        const settings = {
            keyGemini: document.getElementById('keyGemini').value
        };
        Storage.saveSettings(settings);
    };

    document.getElementById('settings-form').addEventListener('change', saveSettings);
    loadSettings();

    // UI Updater Methods
    const ui = {
        map: document.getElementById('workflowMap'),
        stageName: document.getElementById('currentStageName'),
        stageStatus: document.getElementById('currentStageStatus'),
        progressBar: document.getElementById('progressBar'),
        console: document.getElementById('consoleOutput'),
        alert: document.getElementById('alertContainer'),
        
        log(type, msg) {
            const el = document.createElement('div');
            el.className = type;
            el.textContent = `> ${msg}`;
            ui.console.appendChild(el);
            ui.console.scrollTop = ui.console.scrollHeight;
        },
        
        clearError() {
            ui.alert.style.display = 'none';
        },
        
        showError(stageName, errorDetails) {
            document.getElementById('alertTitle').textContent = errorDetails.title || `${stageName} Error`;
            document.getElementById('alertMessage').textContent = errorDetails.message || 'Unknown error occurred.';
            document.getElementById('alertTechLogs').textContent = errorDetails.techDetails || 'No technical details provided.';
            
            const actions = document.getElementById('alertActions');
            actions.innerHTML = '';
            const retryBtn = document.createElement('button');
            retryBtn.textContent = 'Retry ' + stageName;
            retryBtn.onclick = () => {
                ui.clearError();
                document.getElementById('generateForm').dispatchEvent(new Event('submit'));
            };
            actions.appendChild(retryBtn);
            
            ui.alert.style.display = 'flex';
        },

        updateMap(state) {
            ui.map.innerHTML = '';
            let progress = 0;
            
            state.stages.forEach((stage, idx) => {
                const el = document.createElement('div');
                el.className = `map-step ${stage.status}`;
                if (idx === state.currentStageIdx) el.classList.add('active');
                el.textContent = stage.name;
                ui.map.appendChild(el);

                if (stage.status === 'success') progress = (idx + 1) / state.stages.length * 100;
                else if (stage.status === 'running') progress = (idx + 0.5) / state.stages.length * 100;
            });
            
            ui.progressBar.style.width = `${progress}%`;
            
            const curr = state.stages[state.currentStageIdx];
            if (curr) {
                ui.stageName.textContent = curr.name;
                ui.stageStatus.textContent = curr.status;
                ui.stageStatus.className = `badge ${curr.status}`;
            }

            if(state.stages.some(s => s.status === 'running')) {
                ui.progressBar.classList.add('striped');
            } else {
                ui.progressBar.classList.remove('striped');
            }

            // Show download button if Render stage is success
            const renderStage = state.stages.find(s => s.name === 'Render');
            const downloadContainer = document.getElementById('downloadActionContainer');
            if (renderStage && renderStage.status === 'success' && renderStage.output?.final_video_url) {
                downloadContainer.style.display = 'block';
                // Attach url to button
                const btn = document.getElementById('btnDownloadVideo');
                btn.dataset.videoUrl = renderStage.output.final_video_url;
            } else {
                downloadContainer.style.display = 'none';
            }
        }
    };

    // Initialize map
    const pipeline = new PipelineManager(
        (state) => ui.updateMap(state),
        ui.log,
        ui.showError
    );
    
    const currState = Storage.getPipelineState();
    if(currState) ui.updateMap(currState);

    // Image Upload Logic (Drag/Drop/Paste)
    const dropZone = document.getElementById('dropZone');
    const objectFile = document.getElementById('objectFile');
    const dropZonePreview = document.getElementById('dropZonePreview');
    const objectUrlInput = document.getElementById('objectUrl');
    const dropZoneText = document.getElementById('dropZoneText');

    const handleImage = (file) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                dropZonePreview.src = dataUrl;
                dropZonePreview.style.display = 'block';
                dropZoneText.style.display = 'none';
                objectUrlInput.value = dataUrl; // Save base64 for pipeline
            };
            reader.readAsDataURL(file);
        } else {
            ui.log('error-log', 'Please provide a valid image file.');
        }
    };

    dropZone.addEventListener('click', () => objectFile.click());
    
    objectFile.addEventListener('change', (e) => handleImage(e.target.files[0]));

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleImage(e.dataTransfer.files[0]);
    });

    document.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                handleImage(items[i].getAsFile());
                break;
            }
        }
    });

    // Default Pikachu placeholder if nothing uploaded
    objectUrlInput.value = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png";

    // Auto Audio Toggle Logic
    const autoAudioCheck = document.getElementById('autoAudio');
    const audioUrlGroup = document.getElementById('audioUrlGroup');
    autoAudioCheck.addEventListener('change', (e) => {
        audioUrlGroup.style.display = e.target.checked ? 'none' : 'block';
    });

    // Form Submission
    document.getElementById('generateForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        saveSettings();
        ui.clearError();

        // Reset preview and UI states
        document.getElementById('spinningObject').style.display = 'none';
        document.getElementById('loopAudio').pause();
        document.getElementById('downloadActionContainer').style.display = 'none';

        const objectUrl = document.getElementById('objectUrl').value;
        const autoAudio = document.getElementById('autoAudio').checked;
        const audioUrl = document.getElementById('audioUrl').value;
        const bgColor = document.getElementById('bgColor').value;
        const spinSpeed = document.getElementById('spinSpeed').value;
        const use3D = document.getElementById('use3D').checked;

        const resolvedInput = { objectUrl, autoAudio, audioUrl, bgColor, spinSpeed, use3D };
        
        ui.log('info-log', 'Starting Meme Generation pipeline...');
        pipeline.execute(resolvedInput);
    });

    // Preview Event Listener
    document.addEventListener('SpinPreviewReady', (e) => {
        const input = e.detail;
        const previewContainer = document.getElementById('previewContainer');
        const spinningObject = document.getElementById('spinningObject');
        const spinning3D = document.getElementById('spinning3D');
        const loopAudio = document.getElementById('loopAudio');

        previewContainer.style.backgroundColor = input.bgColor;
        
        if (input.use3D) {
            spinningObject.style.display = 'none';
            // Speed for model-viewer is measured in milliseconds per radian or similar, but auto-rotate-delay/auto-rotate handles it.
            // A simple way to control speed is via rotation-per-second CSS variables or native properties, but we'll use auto-rotate.
            // We set the src to a mock GLB and display it.
            spinning3D.src = "https://modelviewer.dev/shared-assets/models/Astronaut.glb"; // Mocked GLB
            spinning3D.style.display = 'block';
            
            // Try to map spin speed intuitively
            let speedMs = Math.max(10, parseInt(input.spinSpeed * 1000));
            // model-viewer doesn't let you set exact RPM easily via attribute without some JS interaction, but we will ensure it rotates.
            spinning3D.setAttribute('rotation-per-second', `${360 / input.spinSpeed}deg`);
        } else {
            spinning3D.style.display = 'none';
            spinningObject.src = input.objectUrl;
            spinningObject.style.setProperty('--spin-speed', `${input.spinSpeed}s`);
            spinningObject.classList.add('spin-anim');
            spinningObject.style.display = 'block';
        }

        loopAudio.src = input.audioUrl;
        loopAudio.play().catch(e => ui.log('warn-log', 'Audio autoplay blocked by browser.'));
    });

    // Download Video Button Logic
    document.getElementById('btnDownloadVideo').addEventListener('click', (e) => {
        const videoUrl = e.currentTarget.dataset.videoUrl;
        if(!videoUrl) return;

        ui.log('info-log', 'Downloading the perfectly looped video...');
        
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = `spinning_meme_${Math.floor(Math.random() * 10000)}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        ui.log('success-log', 'Video downloaded successfully!');
    });
});
