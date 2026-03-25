// simple mock to test performance
const items = Array.from({length: 1000}, (_, i) => i);
async function insert(batch) {
    return new Promise(r => setTimeout(r, 10)); // simulate latency
}

async function testSequential() {
    console.time('sequential');
    for (let i = 0; i < items.length; i += 50) {
        const batch = items.slice(i, i + 50);
        await insert(batch);
    }
    console.timeEnd('sequential');
}

async function testConcurrent() {
    console.time('concurrent');
    const promises = [];
    for (let i = 0; i < items.length; i += 50) {
        const batch = items.slice(i, i + 50);
        promises.push(insert(batch));
    }
    await Promise.all(promises);
    console.timeEnd('concurrent');
}

async function run() {
    await testSequential();
    await testConcurrent();
}

run();
