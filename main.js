const express = require('express');
const path = require('path');
const { IgApiClient } = require('instagram-private-api');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'templates')));

let state = { running: false, sent: 0, logs: [], startTime: null };
let cfg = { sessionid: "", thread_id: 0, messages: [], delay: 12, cycle: 35, break_sec: 40 };

const DEVICES = [
    { phone_manufacturer: "Google", phone_model: "Pixel 8 Pro", android_version: 15, android_release: "15.0.0", app_version: "323.0.0.46.109" },
    { phone_manufacturer: "Samsung", phone_model: "SM-S928B", android_version: 15, android_release: "15.0.0", app_version: "324.0.0.41.110" },
    { phone_manufacturer: "OnePlus", phone_model: "PJZ110", android_version: 15, android_release: "15.0.0", app_version: "322.0.0.40.108" },
    { phone_manufacturer: "Xiaomi", phone_model: "23127PN0CC", android_version: 15, android_release: "15.0.0", app_version: "325.0.0.42.111" },
];

function log(msg) {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    state.logs.push(entry);
    if (state.logs.length > 500) state.logs = state.logs.slice(-500);
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function bomber() {
    const ig = new IgApiClient();
    const device = randomChoice(DEVICES);
    ig.state.device = device;
    ig.state.userAgent = `Instagram ${device.app_version} Android (34/15.0.0; 480dpi; 1080x2340; ${device.phone_manufacturer}; ${device.phone_model}; raven; raven; en_US)`;

    try {
        await ig.session.importSession(cfg.sessionid);
        log("LOGIN SUCCESS — SPAM SHURU");
    } catch (e) {
        log(`LOGIN FAILED → ${e.message.substring(0, 80)}`);
        return;
    }

    let sentInCycle = 0;
    let currentDelay = cfg.delay;

    while (state.running) {
        try {
            const msg = randomChoice(cfg.messages);
            await ig.direct.sendText({ threadIds: [cfg.thread_id], text: msg });
            sentInCycle += 1;
            state.sent += 1;
            log(`SENT #${state.sent} → ${msg.substring(0, 40)}`);

            if (sentInCycle >= cfg.cycle) {
                log(`BREAK ${cfg.break_sec} SECONDS`);
                await new Promise(resolve => setTimeout(resolve, cfg.break_sec * 1000));
                sentInCycle = 0;
                currentDelay = cfg.delay;
            }

            await new Promise(resolve => setTimeout(resolve, (currentDelay + Math.random() * 4 - 2) * 1000));
        } catch (e) {
            log(`SEND FAILED → ${e.message.substring(0, 60)}`);
            currentDelay += 5;
            await new Promise(resolve => setTimeout(resolve, currentDelay * 1000));
        }
    }
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.post("/start", (req, res) => {
    state.running = false;
    setTimeout(() => {
        state = { running: true, sent: 0, logs: ["BOMBING STARTED"], startTime: Date.now() };

        cfg.sessionid = req.body.sessionid.trim();
        cfg.thread_id = parseInt(req.body.thread_id);
        cfg.messages = req.body.messages.split("\n").map(m => m.trim()).filter(m => m);
        cfg.delay = parseFloat(req.body.delay || 12);
        cfg.cycle = parseInt(req.body.cycle || 35);
        cfg.break_sec = parseInt(req.body.break_sec || 40);

        bomber();
        log("THREAD STARTED — WAIT FOR LOGIN");

        res.json({ok: true});
    }, 1000);
});

app.get("/stop", (req, res) => {
    state.running = false;
    log("STOPPED BY USER");
    res.json({ok: true});
});

app.get("/status", (req, res) => {
    let uptime = "00:00:00";
    if (state.startTime) {
        const t = Math.floor((Date.now() - state.startTime) / 1000);
        const h = Math.floor(t / 3600).toString().padStart(2, '0');
        const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
        const s = (t % 60).toString().padStart(2, '0');
        uptime = `${h}:${m}:${s}`;
    }
    res.json({
        running: state.running,
        sent: state.sent,
        uptime: uptime,
        logs: state.logs.slice(-100)
    });
});

const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});
