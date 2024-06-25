type Task = () => Promise<void>

class TaskQueue {
    queue: Task[]
    isProcessing: boolean

    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    // Add a task to the queue
    addTask(task: Task) {
        this.queue.push(task);
        this.processQueue();
    }

    // Process the queue
    async processQueue(): Promise<void> {
        if (this.isProcessing) { return; };
        this.isProcessing = true;

        while (this.queue.length > 0) {
            const task = this.queue.shift();
            if (task !== undefined) {
                try {
                await task();
                } catch (error) {
                console.error('Task failed:', error);
                }
            }
        }

        this.isProcessing = false;
    }
}
  
export const taskQueue = new TaskQueue();
  