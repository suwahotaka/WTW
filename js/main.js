// --- ゲーム状態管理 ---
let state = { faction: null, friendlyCountries: [], target: null, score: 0, time: 90, interval: null, isPlaying: false };
const HIGH_SCORE_KEY = 'wtp_highscore'; 
const GAME_URL = 'https://plicy.net/GamePlay/220963'; // 拡散用URL

const el = {
    svg: document.getElementById('world-map'),
    input: document.getElementById('type-input'),
    targetJp: document.getElementById('target-jp'),
    targetHint: document.getElementById('target-romaji-hint'),
    modeBadge: document.getElementById('mode-badge'),
    score: document.getElementById('score'),
    totalCount: document.getElementById('total-count'),
    timer: document.getElementById('timer'),
    screens: { start: document.getElementById('start-screen'), result: document.getElementById('result-screen') },
    finalScore: document.getElementById('final-score'),
    highScore: document.getElementById('high-score-display'), 
    resultMsg: document.getElementById('result-msg')
};

function initMap() {
    el.svg.innerHTML = '';
    COUNTRY_DATA.forEach(c => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", c.path);
        path.setAttribute("class", "country");
        path.setAttribute("id", `map-${c.id}`);
        path.setAttribute("fill", "#95a5a6");
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${c.name} (${c.keys[0].toUpperCase()})`;
        path.appendChild(title);
        el.svg.appendChild(path);
    });
    el.totalCount.textContent = COUNTRY_DATA.length;
}

// タイトルBGM用イベント
document.body.addEventListener('click', () => {
    if (!state.isPlaying && el.screens.start.classList.contains('hidden') === false) {
        SoundFX.init();
        SoundFX.playBGM('title');
    }
}, { once: true });

// initMap()の後に追加
function optimizeForMobile() {
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        el.input.addEventListener('focus', () => {
            setTimeout(() => {
                el.input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300); // キーボード出現後のスクロール
        });
    }
}
// initMap()の最後に呼び出し: optimizeForMobile();


function startGame(faction, startId) {
    SoundFX.init();
    SoundFX.playBGM('normal');
    SoundFX.playNext();
    
    state.faction = faction;
    state.score = 0;
    state.time = 90;
    state.friendlyCountries = [startId];
    state.isPlaying = true;
    
    el.screens.start.classList.add('hidden');
    el.screens.result.classList.add('hidden');
    el.score.textContent = state.score;
    el.timer.textContent = state.time;
    el.timer.style.color = "#f1c40f";
    el.input.disabled = false;
    el.input.value = '';
    el.input.focus();

    updateMap();
    nextTarget();

    if(state.interval) clearInterval(state.interval);
    state.interval = setInterval(() => {
        state.time--;
        el.timer.textContent = state.time;

        if (state.time === 30) {
            SoundFX.playBGM('hurry');
            el.timer.style.color = "#e74c3c";
        }

        if(state.time <= 0) endGame();
    }, 1000);
}

function nextTarget() {
    let candidates = [];
    const friendlySet = new Set(state.friendlyCountries);
    state.friendlyCountries.forEach(id => {
        const c = COUNTRY_DATA.find(x => x.id === id);
        if(!c) return;
        if(c.seaNeighbors) c.seaNeighbors.forEach(nid => addC(nid));
        if(c.neighbors) c.neighbors.forEach(nid => addC(nid));
    });
    function addC(id) {
        if(!friendlySet.has(id)) {
            const c = COUNTRY_DATA.find(x => x.id === id);
            if(c) candidates.push(c);
        }
    }
    if(candidates.length === 0) { endGame(true); return; }
    candidates = [...new Set(candidates)];
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    let needsCapital = false;
    if (state.faction === 'sea') {
        if (next.type === 'land') needsCapital = true;
    } else {
        if (next.type === 'coast') needsCapital = true;
    }
    state.target = { c: next, phase: 'name', needsCapital: needsCapital };
    updateDisplay();
    highlight(next.id);
}

function updateDisplay() {
    const t = state.target;
    if(t.phase === 'name') {
        el.targetJp.textContent = t.c.name;
        el.targetHint.textContent = t.c.keys[0].toUpperCase();
        el.modeBadge.classList.add('hidden');
        el.input.placeholder = "国名(ローマ字)を入力";
    } else {
        el.targetJp.textContent = t.c.capitalName;
        el.targetHint.textContent = t.c.capitalKeys[0].toUpperCase();
        el.modeBadge.classList.remove('hidden');
        el.input.placeholder = "首都名(ローマ字)を入力";
    }
}

function updateMap() {
    document.querySelectorAll('.country').forEach(e => {
        e.setAttribute('fill', '#95a5a6');
        e.classList.remove('target-marker');
    });
    const color = state.faction === 'sea' ? '#3498db' : '#e74c3c';
    state.friendlyCountries.forEach(id => {
        const e = document.getElementById(`map-${id}`);
        if(e) e.setAttribute('fill', color);
    });
}

function highlight(id) {
    const e = document.getElementById(`map-${id}`);
    if(e) {
        e.setAttribute('fill', '#f1c40f');
        e.classList.add('target-marker');
        e.parentNode.appendChild(e);
    }
}

el.input.addEventListener('input', (e) => {
    if(!state.isPlaying || !state.target) return;
    if(e.inputType !== "deleteContentBackward") SoundFX.playKey();

    const rawVal = e.target.value.toLowerCase().replace(/\s+/g, '');
    const t = state.target;
    const validKeys = (t.phase === 'name') ? t.c.keys : t.c.capitalKeys;
    const normalize = (str) => {
        return str
            .replace(/shi/g, 'si')  .replace(/chi/g, 'ti')
            .replace(/tsu/g, 'tu')  .replace(/fu/g, 'hu')
            .replace(/ji/g, 'zi')   .replace(/jya/g, 'zya')
            .replace(/sha/g, 'sya') .replace(/shu/g, 'syu') .replace(/sho/g, 'syo')
            .replace(/cha/g, 'tya') .replace(/chu/g, 'tyu') .replace(/cho/g, 'tyo')
            .replace(/ja/g, 'zya')  .replace(/ju/g, 'zyu')  .replace(/jo/g, 'zyo');
    };
    const inputNorm = normalize(rawVal);
    const isMatch = validKeys.some(key => normalize(key) === inputNorm);

    if (isMatch) {
        e.target.value = '';
        if(t.phase === 'name' && t.needsCapital) {
            t.phase = 'capital';
            SoundFX.playNext();
            updateDisplay();
        } else {
            SoundFX.playConquer();
            state.friendlyCountries.push(t.c.id);
            state.score++;
            el.score.textContent = state.score;
            updateMap();
            nextTarget();
        }
    }
});

// --- ゲーム終了 & ランキング処理 ---
function endGame(cleared = false) {
    state.isPlaying = false;
    clearInterval(state.interval);
    el.input.disabled = true;
    el.screens.result.classList.remove('hidden');
    el.finalScore.textContent = state.score;

    // ハイスコア判定 (ローカル保存)
    const savedHigh = localStorage.getItem(HIGH_SCORE_KEY) || 0;
    if (state.score > savedHigh) {
        localStorage.setItem(HIGH_SCORE_KEY, state.score);
        el.highScore.textContent = `ハイスコア更新！ (${state.score})`;
    } else {
        el.highScore.textContent = `ハイスコア: ${savedHigh}`;
    }

    // ★PliCyのランキングにスコアを送信する処理
    if (window.PLiCy && window.PLiCy.submitScore) {
        window.PLiCy.submitScore(state.score);
    }
    
    if(cleared) {
        SoundFX.playWin();
        document.getElementById('result-title').textContent = "完全制覇達成！";
        document.getElementById('result-title').style.color = "#f1c40f";
        el.resultMsg.textContent = "世界はあなたのものです！";
    } else {
        SoundFX.playOver();
        document.getElementById('result-title').textContent = "作戦終了";
        document.getElementById('result-title').style.color = "#fff";
        el.resultMsg.textContent = "お疲れ様でした。";
    }
}

// --- QRコード付き地図保存機能 ---
function saveMapImage() {
    // 1. QRコードを一時的なdivに生成
    const qrDiv = document.createElement('div');
    const qr = new QRCode(qrDiv, {
        text: GAME_URL,
        width: 100,
        height: 100,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    // SVGのシリアライズ
    const svgData = new XMLSerializer().serializeToString(el.svg);
    const canvas = document.createElement("canvas");
    canvas.width = 1000; 
    canvas.height = 560; // QRコード用に少し縦を伸ばす
    const ctx = canvas.getContext("2d");

    // 画像読み込み用Promise
    const loadImg = (src) => new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
    });

    // 処理開始
    (async () => {
        // 背景
        ctx.fillStyle = "#1a252f"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 地図描画
        const svgBlob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
        const svgUrl = URL.createObjectURL(svgBlob);
        const mapImg = await loadImg(svgUrl);
        ctx.drawImage(mapImg, 0, 0);
        URL.revokeObjectURL(svgUrl);

        // QRコード描画 (ライブラリがimgタグを作るのを待つ必要あり)
        const qrImgElement = qrDiv.querySelector('img');
        if(qrImgElement) {
            // base64化されるのを少し待つか、srcを直接使う
            // qrcode.jsは同期的にimg.srcにDataURLを入れるのですぐ使えるはず
             // QRの背景白枠
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(880, 440, 110, 110);
            ctx.drawImage(qrImgElement, 885, 445);
        }

        // テキスト情報描画
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 30px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`W.T.P. - World Type War`, 20, 530);
        
        ctx.font = "20px sans-serif";
        ctx.fillText(`制圧国数: ${state.score} / ${COUNTRY_DATA.length}`, 20, 555);

        ctx.textAlign = "right";
        ctx.fillText("Play Now!", 870, 550);

        // ダウンロード
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `wtp_result_${state.score}.png`;
        link.click();
    })();
}

document.querySelectorAll('.btn-start').forEach(b => {
    b.addEventListener('click', () => {
        const f = b.getAttribute('data-faction');
        const c = b.getAttribute('data-country');
        if(f && c) startGame(f, c);
    });
});

document.getElementById('btn-save-map').addEventListener('click', saveMapImage);


initMap();
