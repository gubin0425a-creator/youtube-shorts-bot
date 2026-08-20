const STAGES = ['AutoAudio', 'PrepareAsset', 'Generate3D', 'LoopAudio', 'Animate', 'Render', 'OptimizeSEO', 'Upload'];

class PipelineManager {
    constructor(onStateChange, onLog, onError) {
        this.onStateChange = onStateChange;
        this.onLog = onLog;
        this.onError = onError;
        this.isRunning = false;
        
        let state = Storage.getPipelineState();
        if (!state) {
            this.resetState();
        }
    }

    resetState() {
        const state = {
            currentStageIdx: 0,
            stages: STAGES.map(name => ({
                name,
                status: 'pending', 
                result: null
            })),
            input: null
        };
        Storage.savePipelineState(state);
    }

    async execute(resolvedInput) {
        if (this.isRunning) return;
        this.isRunning = true;

        let state = Storage.getPipelineState();
        if (!state || JSON.stringify(state.input) !== JSON.stringify(resolvedInput)) {
            this.resetState();
            state = Storage.getPipelineState();
            state.input = resolvedInput;
            Storage.savePipelineState(state);
        }

        const settings = Storage.getSettings();

        let startIdx = state.stages.findIndex(s => s.status !== 'success');
        if (startIdx === -1) startIdx = 0; // restart if done

        for (let i = startIdx; i < STAGES.length; i++) {
            if (!this.isRunning) break;

            const stageName = STAGES[i];
            state.currentStageIdx = i;
            state.stages[i].status = 'running';
            Storage.savePipelineState(state);
            this.onStateChange(state);

            try {
                const moduleFunc = Modules[stageName];
                const output = await moduleFunc(state.input, settings, this.onLog);
                
                state.stages[i].result = output;
                
                if (output.status === 'error') {
                    state.stages[i].status = 'error';
                    Storage.savePipelineState(state);
                    this.onStateChange(state);
                    this.onError(stageName, output.errors);
                    this.isRunning = false;
                    return;
                }

                state.stages[i].status = 'success';
                Storage.savePipelineState(state);
                this.onStateChange(state);

            } catch (err) {
                this.onLog('error-log', `Fatal error in ${stageName}: ${err.message}`);
                state.stages[i].status = 'error';
                state.stages[i].result = createOutput('error', null, null, [], {
                    title: "Unexpected Error",
                    message: "A critical system error occurred.",
                    techDetails: err.stack
                }, "retry");
                Storage.savePipelineState(state);
                this.onStateChange(state);
                this.onError(stageName, state.stages[i].result.errors);
                this.isRunning = false;
                return;
            }
        }

        this.isRunning = false;
        this.onLog('success-log', 'Pipeline execution completed successfully.');
    }

    stop() {
        this.isRunning = false;
    }
}
