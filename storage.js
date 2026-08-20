const Storage = {
    getProjectId: () => {
        let pid = localStorage.getItem('shorts_project_id');
        if (!pid) {
            pid = 'proj_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('shorts_project_id', pid);
        }
        return pid;
    },
    
    getPipelineState: () => {
        const data = localStorage.getItem(`pipeline_state_${Storage.getProjectId()}`);
        return data ? JSON.parse(data) : null;
    },

    savePipelineState: (state) => {
        localStorage.setItem(`pipeline_state_${Storage.getProjectId()}`, JSON.stringify(state));
    },

    saveArtifact: (name, content) => {
        const key = `artifact_${Storage.getProjectId()}_${name}`;
        localStorage.setItem(key, typeof content === 'string' ? content : JSON.stringify(content));
    },

    getArtifact: (name) => {
        const key = `artifact_${Storage.getProjectId()}_${name}`;
        const data = localStorage.getItem(key);
        try {
            return JSON.parse(data);
        } catch {
            return data;
        }
    },

    getSettings: () => {
        const data = localStorage.getItem('shorts_settings');
        return data ? JSON.parse(data) : {
            model: 'gemini-1.5-pro',
            keyGemini: ''
        };
    },

    saveSettings: (settings) => {
        localStorage.setItem('shorts_settings', JSON.stringify(settings));
    },

    clearProject: () => {
        const pid = Storage.getProjectId();
        Object.keys(localStorage).forEach(key => {
            if (key.includes(pid)) {
                localStorage.removeItem(key);
            }
        });
        localStorage.removeItem('shorts_project_id'); // force new project
    }
};
