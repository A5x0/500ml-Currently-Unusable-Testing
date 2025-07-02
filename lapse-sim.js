const status = document.getElementById("status");
status.textContent = "250ml spilled. Time for the other 250.";

// SceAIO submit commands
const SCE_KERNEL_AIO_CMD_READ = 0x001;
const SCE_KERNEL_AIO_CMD_WRITE = 0x002;
const SCE_KERNEL_AIO_CMD_MASK = 0xfff;

// SceAIO submit command flags
const SCE_KERNEL_AIO_CMD_MULTI = 0x1000;

const SCE_KERNEL_AIO_PRIORITY_LOW = 1;
const SCE_KERNEL_AIO_PRIORITY_MID = 2;
const SCE_KERNEL_AIO_PRIORITY_HIGH = 3;

class SceKernelAioResult {
    constructor(returnValue, state) {
        this.returnValue = returnValue;
        this.state = state;
    }
}

class SceKernelAioRWRequest {
    constructor(offset, nbyte, buf, result, fd) {
        this.offset = offset;
        this.nbyte = nbyte;
        this.buf = buf;
        this.result = result;
        this.fd = fd;
    }
}

// Simulating pthread functionality in JavaScript
class PThread {
    constructor() {
        this.barrier = {
            count: 0,
            max: 0,
            promise: null,
            resolve: null
        };
    }

    barrierInit(max) {
        this.barrier.count = 0;
        this.barrier.max = max;
        this.barrier.promise = new Promise((resolve) => {
            this.barrier.resolve = resolve;
        });
    }

    barrierWait() {
        this.barrier.count++;
        if (this.barrier.count === this.barrier.max) {
            this.barrier.resolve();
        }
        return this.barrier.promise;
    }

    create(func, arg) {
        return new Promise((resolve) => {
            const result = func(arg);
            resolve(result);
        });
    }

    join(thread) {
        return thread;
    }
}

// Simulating AIO functions (mock implementations)
function aio_submit_cmd(cmd, reqs, num_reqs, prio, ids) {
    // Placeholder implementation
    for (let i = 0; i < num_reqs; i++) {
        ids[i] = i;
    }
    return 0;
}

function aio_multi_wait(ids, num_ids, sce_errors, mode, usec) {
    // Placeholder implementation
    return 0;
}

function aio_multi_delete(ids, num_ids, sce_errors) {
    // Placeholder implementation
    return 0;
}

async function main() {
    const pthread = new PThread();
    const num_reqs = 3;
    const which_req = 0;
    const race_errs = [0, 0];

    const reqs = new Array(num_reqs).fill(null).map(() => new SceKernelAioRWRequest(0, 0, null, null, -1));
    const ids = new Array(num_reqs).fill(0);
    const sce_errs = new Array(num_reqs).fill(0);

    pthread.barrierInit(2);

    for (let i = 0; i < 100; i++) {
        aio_submit_cmd(
            SCE_KERNEL_AIO_CMD_WRITE | SCE_KERNEL_AIO_CMD_MULTI,
            reqs,
            num_reqs,
            SCE_KERNEL_AIO_PRIORITY_HIGH,
            ids
        );

        aio_multi_wait(ids, num_reqs, sce_errs, 0x01, 0);

        const raceFunc = (arg) => {
            pthread.barrierWait();
            aio_multi_delete(arg, 1, [race_errs[1]]);
            return null;
        };

        const raceThread = pthread.create(raceFunc, [ids[which_req]]);
        await pthread.barrierWait();

        aio_multi_delete([ids[which_req]], 1, [race_errs[0]]);

        await pthread.join(raceThread);

        if (race_errs[0] === race_errs[1]) {
            console.log("Double Free achieved!");
            return 0;
        }
    }

    console.log("Double Free failed");
    return 0;
}

// Call the main function
main().catch(console.error);
