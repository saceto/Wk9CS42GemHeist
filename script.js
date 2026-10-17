/*  Students: Please use this week's project for Week 9: Assignment 11: Enemy AI Pathfinding. 
     You will need to modify the contents of this JavaScript file with your own code, 
     and create - or add - any other files as called for by the assignment requirements.
     When you are done, be certain to upload a .zip of your project files and submit the 
     assignment in Canvas to be graded. */


//
// OPTIONAL: YOU HAVE MY PERMISSION TO USE THE UTILITY FUNCTIONS BELOW
//

//
// EasyStar utility: Part 1 of code to implement pathfinding: build nested array of tilemap for easystar
//
function convertMapForEasyStar(layerForPath) {
    // create an instance of the easystar a* pathfinder
    finder = new EasyStar.js();
    // now we need to create a data model, an array, that represent collidable tiles in our map
    let grid = [];
    let tile;
    // build a nested array of the tilese in the phaser tilemap
    // define outer loop for vertical y coords
    for ( let y = 0; y < map.height; y++ ) {
        let col = [];
        // define inner loop to move thru each x coord in tilemap inside current row defined by y
        for ( let x = 0; x < map.width; x++ ) {
            // phaser getTileAt() method gets tile props for tile in map
            tile = map.getTileAt(x, y, true, layerForPath);
            col.push( tile.index );
        }
        grid.push(col);
    }
    //console.log(grid);
    // pass to easystar the tile layout for the tilemap layer saved in grid
    finder.setGrid( grid );
}

//
// EasyStar utility: Part 2 of code to implement pathfinding
// identify tiles that are not collidable and their weighted score for preference of traversal
//
function manageCollidablesForEasyStar(tilesetForPath) {
    let tileprops = tilesetForPath.tileProperties;

    // loop thru each tile by id and check the custom Tiled properties we set
    let acceptabletiles = [];
    for ( let i = tilesetForPath.firstgid - 1; i < tilesetForPath.total; i++ ) {
        // checking for the custom property named "collides" set in Tiled 
        if ( ! tileprops[i].collides ) {
            acceptabletiles.push( i+1 );
        }
        // if this tile can be traversed and has a score value, also pass that to easystar
        if ( tileprops[i].score ) {
          finder.setTileCost( i+1, tileprops[i].score );
        }
    }
    //console.log(acceptabletiles);
    finder.setAcceptableTiles( acceptabletiles );
}

/* =====================================================================
   GEM HEIST  -  Enemy AI Pathfinding with EasyStar + Phaser 4

   You are the blue hero. Collect every gem before the monsters get you.
     * RED hunter     - uses EasyStar to chase YOU directly.
     * ORANGE ambusher - uses EasyStar to path to a tile AHEAD of you.
     * PURPLE thief   - uses EasyStar to path to the nearest GEM and steal it.
   Input:  keyboard (arrows / WASD)  or  pointer (click / tap to walk there,
           the hero also uses EasyStar to find its route).
   Map:    assets/map.json (Tiled JSON) + assets/tiles.png tileset, with
           custom tile properties  collides / score / slow.
   ===================================================================== */

// globals the provided EasyStar utility functions rely on
let map;      // Phaser tilemap
let finder;   // EasyStar pathfinder instance (created by convertMapForEasyStar)

const TILE = 32;
const GAME_W = 800;
const GAME_H = 608;
const FONT = 'Verdana, Arial, sans-serif';

// ---------------------------------------------------------------- helpers
function tileCenter(tx, ty) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// move an object along a list of pixel waypoints at a given speed (px/sec)
function stepAlongPath(obj, path, speed, dtSec) {
    let move = speed * dtSec;
    while (move > 0 && path.length) {
        const t = path[0];
        const dx = t.x - obj.x, dy = t.y - obj.y;
        const d = Math.hypot(dx, dy);
        if (d <= move) {
            obj.x = t.x; obj.y = t.y;
            path.shift();
            move -= d;
        } else {
            obj.x += (dx / d) * move;
            obj.y += (dy / d) * move;
            move = 0;
        }
    }
}

// show any JavaScript / asset-loading problem on the page itself (not only in the console)
const failedAssets = [];
function showFatal(msg) {
    let d = document.getElementById('errbox');
    if (!d) {
        d = document.createElement('pre');
        d.id = 'errbox';
        d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:40%;overflow:auto;margin:0;' +
            'padding:8px 12px;background:#300;color:#ffb3b3;font:13px monospace;z-index:9999;white-space:pre-wrap';
        document.body.appendChild(d);
    }
    d.textContent += msg + '\n';
}
window.addEventListener('error', e => showFatal('ERROR: ' + e.message + (e.filename ? '  (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : '')));
window.addEventListener('unhandledrejection', e => showFatal('PROMISE: ' + ((e.reason && e.reason.message) || e.reason)));

function safeGet(key) {
    try { return parseInt(localStorage.getItem(key)) || 0; } catch (e) { return 0; }
}
function safeSet(key, v) {
    try { localStorage.setItem(key, String(v)); } catch (e) { /* ignore */ }
}

// =====================================================================
//  PRELOAD: load every external asset file
// =====================================================================
class PreloadScene extends Phaser.Scene {
    constructor() { super('Preload'); }

    preload() {
        this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x12161f);
        this.add.text(GAME_W / 2, GAME_H / 2 - 40, 'Loading...', {
            fontFamily: FONT, fontSize: '24px', color: '#ffffff'
        }).setOrigin(0.5);
        const frame = this.add.rectangle(GAME_W / 2, GAME_H / 2, 304, 24).setStrokeStyle(2, 0xffffff);
        const bar = this.add.rectangle(GAME_W / 2 - 150, GAME_H / 2, 0, 16, 0x6ee7b7).setOrigin(0, 0.5);
        this.load.on('progress', v => { bar.width = 300 * v; });
        this.load.on('loaderror', f => { failedAssets.push(f.url || f.key); showFatal('Could not load asset: ' + (f.url || f.key)); });

        this.load.setPath('assets/');
        // tilemap (Tiled JSON) + its tileset image
        this.load.image('terrainImg', 'tiles.png');
        this.load.tilemapTiledJSON('level', 'map.json');
        // sprites
        this.load.image('player', 'player.png');
        this.load.image('hunter', 'hunter.png');
        this.load.image('ambusher', 'ambusher.png');
        this.load.image('thief', 'thief.png');
        this.load.image('gem', 'gem.png');
        this.load.image('heart', 'heart.png');
        this.load.image('marker', 'marker.png');
        // sound effects
        ['collect', 'hit', 'steal', 'stomp', 'wave', 'gameover'].forEach(n => {
            this.load.audio(n, 'audio/' + n + '.wav');
        });
    }

    create() { this.scene.start('Menu'); }
}

// =====================================================================
//  MENU
// =====================================================================
class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }

    create() {
        this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x12161f);
        const title = this.add.text(GAME_W / 2, 90, 'GEM HEIST', {
            fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: '#6ee7b7',
            stroke: '#06281d', strokeThickness: 8
        }).setOrigin(0.5);
        this.tweens.add({ targets: title, scale: 1.06, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.add.text(GAME_W / 2, 145, 'Enemy AI powered by EasyStar A* pathfinding', {
            fontFamily: FONT, fontSize: '16px', color: '#9fb3c8'
        }).setOrigin(0.5);

        const rows = [
            ['player',   'YOU  -  arrows / WASD to move, or click / tap a tile to walk there'],
            ['gem',      'Collect every gem to clear the wave  (+10 each)'],
            ['hunter',   'HUNTER  -  chases you down the shortest path'],
            ['ambusher', 'AMBUSHER  -  cuts you off by heading to where you are going'],
            ['thief',    'THIEF  -  runs for the nearest gem and steals it. Touch it to stun it (+20)']
        ];
        rows.forEach((r, i) => {
            const y = 215 + i * 58;
            this.add.image(110, y, r[0]);
            this.add.text(150, y, r[1], {
                fontFamily: FONT, fontSize: '16px', color: '#e8eef5', wordWrap: { width: 600 }
            }).setOrigin(0, 0.5);
        });
        this.add.text(GAME_W / 2, 525, 'Mud slows everyone down.   P = show AI paths    M = mute', {
            fontFamily: FONT, fontSize: '15px', color: '#9fb3c8'
        }).setOrigin(0.5);

        const prompt = this.add.text(GAME_W / 2, 570, 'Click or press ENTER to start', {
            fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);
        this.tweens.add({ targets: prompt, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });

        const best = safeGet('gemheist-best');
        if (best > 0) {
            this.add.text(GAME_W - 12, 40, 'Best: ' + best, {
                fontFamily: FONT, fontSize: '16px', color: '#ffd166'
            }).setOrigin(1, 0);
        }

        let started = false;
        const go = () => {
            if (started) return;
            started = true;
            window.removeEventListener('keydown', onKey);
            this.scene.start('Game');
        };
        const onKey = e => { if (e.key === 'Enter' || e.key === ' ') go(); };
        window.addEventListener('keydown', onKey);       // works even if Phaser's keyboard isn't focused
        this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
        this.input.once('pointerdown', go);
    }
}

// =====================================================================
//  GAME
// =====================================================================
class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        this.score = 0;
        this.lives = 3;
        this.wave = 1;
        this.state = 'playing';        // playing | banner | over
        this.showPaths = true;
        this.playerPath = null;
        this.facing = { x: 1, y: 0 };
        this.invulnUntil = 0;
        this.enemies = [];
        this.gems = [];

        // ---------- tile map (external Tiled JSON + tileset image) ----------
        map = this.make.tilemap({ key: 'level' });
        const tileset = map.addTilesetImage('terrain', 'terrainImg');
        this.tileset = tileset;
        this.ground = map.createLayer('Ground', tileset, 0, 0);

        // collision from the custom "collides" tile property set in Tiled
        const solid = [];
        for (let i = 0; i < tileset.total; i++) {
            if (tileset.tileProperties[i] && tileset.tileProperties[i].collides) solid.push(i + 1);
        }
        this.ground.setCollision(solid);

        // terrain lookup table (walkable / slow) built from tileset properties
        this.terrain = [];
        for (let y = 0; y < map.height; y++) {
            const row = [];
            for (let x = 0; x < map.width; x++) {
                const t = map.getTileAt(x, y, true, this.ground);
                row.push(tileset.tileProperties[t.index - 1] || {});
            }
            this.terrain.push(row);
        }

        // ---------- EasyStar setup using the provided utility functions ----------
        convertMapForEasyStar(this.ground);       // part 1: build grid from tilemap layer
        manageCollidablesForEasyStar(tileset);    // part 2: acceptable tiles + tile costs
        finder.setIterationsPerCalculation(1000);

        // ---------- spawn points + gem candidates from Tiled object layers ----------
        this.spawns = {};
        map.getObjectLayer('Spawns').objects.forEach(o => { this.spawns[o.name] = { x: o.x, y: o.y }; });
        this.gemSpots = map.getObjectLayer('Gems').objects.map(o => ({ x: o.x, y: o.y }));

        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

        // ---------- graphics layers ----------
        this.debugGfx = this.add.graphics().setDepth(5);
        this.marker = this.add.image(0, 0, 'marker').setVisible(false).setDepth(4).setAlpha(0.8);
        this.tweens.add({ targets: this.marker, scale: 0.7, duration: 400, yoyo: true, repeat: -1 });

        // ---------- player ----------
        this.player = this.physics.add.sprite(this.spawns.player.x, this.spawns.player.y, 'player').setDepth(10);
        this.player.body.setSize(22, 22);
        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, this.ground);

        // ---------- enemies ----------
        this.addEnemy('hunter',   this.spawns.hunter,   92);
        this.addEnemy('ambusher', this.spawns.ambusher, 86);
        this.addEnemy('thief',    this.spawns.thief,    108);

        this.spawnGems();

        // ---------- HUD ----------
        const hud = { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4 };
        this.scoreText = this.add.text(40, 6, '', hud).setDepth(50);
        this.waveText = this.add.text(GAME_W / 2, 6, '', hud).setOrigin(0.5, 0).setDepth(50);
        this.hearts = [];
        for (let i = 0; i < 3; i++) {
            this.hearts.push(this.add.image(GAME_W - 40 - i * 26, 17, 'heart').setDepth(50));
        }
        this.add.text(GAME_W / 2, GAME_H - 17, 'Arrows/WASD or click to move  |  P: AI paths  |  M: mute', {
            fontFamily: FONT, fontSize: '13px', color: '#ffffff', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(50);
        this.updateHud();

        // ---------- input: keyboard + pointer ----------
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('W,A,S,D,P,M,R,ENTER');
        this.input.keyboard.on('keydown-P', () => { this.showPaths = !this.showPaths; this.debugGfx.clear(); });
        this.input.keyboard.on('keydown-M', () => { this.sound.mute = !this.sound.mute; });
        this.input.keyboard.on('keydown-R', () => { if (this.state === 'over') this.scene.restart(); });
        this.input.keyboard.on('keydown-ENTER', () => { if (this.state === 'over') this.scene.restart(); });
        this.input.on('pointerdown', p => this.onPointer(p));

        this.cameras.main.fadeIn(300);
    }

    // ------------------------------------------------------------ setup helpers
    // play a sound effect; never let a missing/undecodable sound crash the game
    sfx(key) {
        try { if (this.cache.audio.exists(key)) this.sound.play(key); } catch (e) { /* ignore audio problems */ }
    }

    addEnemy(type, pos, baseSpeed) {
        const sprite = this.add.sprite(pos.x, pos.y, type).setDepth(9);
        this.enemies.push({
            type, sprite, baseSpeed,
            home: { x: pos.x, y: pos.y },
            path: [], pending: false, nextRepath: 0, stunUntil: 0, wanderTile: null
        });
    }

    spawnGems() {
        this.gems.forEach(g => g.destroy());
        this.gems = [];
        const count = Math.min(8 + this.wave * 2, 18);
        shuffle(this.gemSpots.slice()).slice(0, count).forEach(p => {
            const g = this.add.image(p.x, p.y, 'gem').setDepth(6);
            this.tweens.add({
                targets: g, scale: 1.18, duration: 500 + Math.random() * 300,
                yoyo: true, repeat: -1, ease: 'Sine.inOut'
            });
            this.gems.push(g);
        });
    }

    worldToTile(x, y) {
        return { x: Phaser.Math.Clamp(Math.floor(x / TILE), 0, map.width - 1),
                 y: Phaser.Math.Clamp(Math.floor(y / TILE), 0, map.height - 1) };
    }

    isWalkable(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
        return !this.terrain[ty][tx].collides;
    }

    isSlow(x, y) {
        const t = this.worldToTile(x, y);
        return !!this.terrain[t.y][t.x].slow;
    }

    nearestWalkable(tx, ty) {
        for (let r = 0; r <= 2; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (this.isWalkable(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
                }
            }
        }
        return null;
    }

    updateHud() {
        this.scoreText.setText('Score ' + this.score);
        this.waveText.setText('Wave ' + this.wave + '   Gems left ' + this.gems.length);
        this.hearts.forEach((h, i) => h.setVisible(i < this.lives));
    }

    floatText(x, y, msg, color) {
        const t = this.add.text(x, y, msg, {
            fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: color || '#ffffff',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(60);
        this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    }

    // ------------------------------------------------------------ pointer input
    onPointer(p) {
        if (this.state === 'over') {
            if (this.time.now - this.overAt > 500) this.scene.restart();
            return;
        }
        if (this.state !== 'playing') return;
        const t = this.nearestWalkable(Math.floor(p.worldX / TILE), Math.floor(p.worldY / TILE));
        if (!t) return;
        const s = this.worldToTile(this.player.x, this.player.y);
        // EasyStar also finds the route for the player's click-to-move
        finder.findPath(s.x, s.y, t.x, t.y, path => {
            if (!path) return;
            this.playerPath = path.map(n => tileCenter(n.x, n.y));
            if (this.playerPath.length > 1) this.playerPath.shift();
            const c = tileCenter(t.x, t.y);
            this.marker.setPosition(c.x, c.y).setVisible(true);
        });
    }

    // ------------------------------------------------------------ update loop
    update(time, delta) {
        finder.calculate();            // let EasyStar work on queued path requests
        if (this.state !== 'playing') return;

        const dt = delta / 1000;
        this.updatePlayer(dt);
        this.enemies.forEach(e => this.updateEnemy(e, time, dt));
        this.checkGems(time);
        this.checkEnemies(time);
        this.drawDebug();

        // blink while invulnerable
        this.player.setAlpha(time < this.invulnUntil ? (Math.floor(time / 90) % 2 ? 0.35 : 1) : 1);
    }

    updatePlayer(dt) {
        const k = this.cursors, w = this.keys;
        let vx = 0, vy = 0;
        if (k.left.isDown || w.A.isDown) vx -= 1;
        if (k.right.isDown || w.D.isDown) vx += 1;
        if (k.up.isDown || w.W.isDown) vy -= 1;
        if (k.down.isDown || w.S.isDown) vy += 1;

        const speed = 165 * (this.isSlow(this.player.x, this.player.y) ? 0.55 : 1);

        if (vx || vy) {
            // keyboard overrides click-to-move
            this.playerPath = null;
            this.marker.setVisible(false);
            const len = Math.hypot(vx, vy);
            vx /= len; vy /= len;
        } else if (this.playerPath && this.playerPath.length) {
            const t = this.playerPath[0];
            const dx = t.x - this.player.x, dy = t.y - this.player.y;
            const d = Math.hypot(dx, dy);
            if (d < Math.max(4, speed * dt)) {
                this.playerPath.shift();
                if (!this.playerPath.length) this.marker.setVisible(false);
            } else {
                vx = dx / d; vy = dy / d;
            }
        }

        this.player.setVelocity(vx * speed, vy * speed);
        if (vx || vy) {
            // remember the dominant direction (used by the ambusher's AI)
            this.facing = Math.abs(vx) > Math.abs(vy) ? { x: Math.sign(vx), y: 0 } : { x: 0, y: Math.sign(vy) };
            if (vx) this.player.setFlipX(vx < 0);
        }
    }

    // ------------------------------------------------------------ enemy AI (EasyStar)
    pickTarget(e) {
        const p = this.worldToTile(this.player.x, this.player.y);
        const me = this.worldToTile(e.sprite.x, e.sprite.y);

        if (e.type === 'hunter') {
            return p;                                   // straight at the player
        }

        if (e.type === 'ambusher') {
            // when close, just chase; otherwise aim a few tiles ahead of the player
            if (Math.abs(p.x - me.x) + Math.abs(p.y - me.y) > 5) {
                for (let n = 4; n >= 1; n--) {
                    const tx = p.x + this.facing.x * n, ty = p.y + this.facing.y * n;
                    if (this.isWalkable(tx, ty)) return { x: tx, y: ty };
                }
            }
            return p;
        }

        // thief: nearest gem; if none are left, run away from the player
        if (this.gems.length) {
            let best = null, bestD = Infinity;
            this.gems.forEach(g => {
                const d = Math.abs(g.x - e.sprite.x) + Math.abs(g.y - e.sprite.y);
                if (d < bestD) { bestD = d; best = g; }
            });
            return this.worldToTile(best.x, best.y);
        }
        if (!e.wanderTile || (me.x === e.wanderTile.x && me.y === e.wanderTile.y)) {
            let far = null, farD = -1;
            for (let i = 0; i < 12; i++) {
                const tx = Phaser.Math.Between(1, map.width - 2), ty = Phaser.Math.Between(1, map.height - 2);
                if (!this.isWalkable(tx, ty)) continue;
                const d = Math.abs(tx - p.x) + Math.abs(ty - p.y);
                if (d > farD) { farD = d; far = { x: tx, y: ty }; }
            }
            e.wanderTile = far;
        }
        return e.wanderTile;
    }

    requestPath(e, time) {
        const target = this.pickTarget(e);
        if (!target) return;
        const s = this.worldToTile(e.sprite.x, e.sprite.y);
        e.pending = true;
        finder.findPath(s.x, s.y, target.x, target.y, path => {
            e.pending = false;
            e.nextRepath = this.time.now + 280;     // throttle: re-plan ~3.5x per second
            if (!path) { e.path = []; return; }
            const pts = path.map(n => tileCenter(n.x, n.y));
            // if we are already past the first node, don't walk backwards to it
            if (pts.length > 1) {
                const a = Math.hypot(e.sprite.x - pts[1].x, e.sprite.y - pts[1].y);
                const b = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                if (a < b) pts.shift();
            }
            e.path = pts;
        });
    }

    updateEnemy(e, time, dt) {
        const spr = e.sprite;
        if (time < e.stunUntil) {                    // stunned: flicker in place
            spr.setAlpha(Math.floor(time / 80) % 2 ? 0.3 : 0.8);
            return;
        }
        spr.setAlpha(1);

        if (!e.pending && time >= e.nextRepath) this.requestPath(e, time);

        const waveBoost = 1 + (this.wave - 1) * 0.08;
        const mud = this.isSlow(spr.x, spr.y) ? 0.55 : 1;
        const px = spr.x;
        stepAlongPath(spr, e.path, e.baseSpeed * waveBoost * mud, dt);
        if (Math.abs(spr.x - px) > 0.05) spr.setFlipX(spr.x < px);
    }

    // ------------------------------------------------------------ collisions & rules
    checkGems(time) {
        // player collects gems
        for (let i = this.gems.length - 1; i >= 0; i--) {
            const g = this.gems[i];
            if (Phaser.Math.Distance.Between(g.x, g.y, this.player.x, this.player.y) < 22) {
                this.score += 10;
                this.sfx('collect');
                this.floatText(g.x, g.y, '+10', '#7df9ff');
                g.destroy();
                this.gems.splice(i, 1);
            }
        }
        // thief steals gems
        const thief = this.enemies.find(e => e.type === 'thief');
        if (thief && time >= thief.stunUntil) {
            for (let i = this.gems.length - 1; i >= 0; i--) {
                const g = this.gems[i];
                if (Phaser.Math.Distance.Between(g.x, g.y, thief.sprite.x, thief.sprite.y) < 20) {
                    this.score = Math.max(0, this.score - 5);
                    this.sfx('steal');
                    this.floatText(g.x, g.y, 'Stolen! -5', '#ff8fa3');
                    g.destroy();
                    this.gems.splice(i, 1);
                    thief.path = [];
                    thief.nextRepath = 0;
                }
            }
        }
        this.updateHud();
        if (this.gems.length === 0) this.nextWave();
    }

    checkEnemies(time) {
        this.enemies.forEach(e => {
            if (time < e.stunUntil && e.type !== 'thief') return;
            const d = Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y);
            if (d > 24) return;

            if (e.type === 'thief') {
                if (time >= e.stunUntil) {           // stomp the thief!
                    e.stunUntil = time + 2500;
                    e.path = [];
                    this.score += 20;
                    this.sfx('stomp');
                    this.floatText(e.sprite.x, e.sprite.y - 10, 'Caught! +20', '#ffd166');
                    this.updateHud();
                }
            } else if (time >= this.invulnUntil) {
                this.loseLife(time);
            }
        });
    }

    loseLife(time) {
        this.lives--;
        this.sfx('hit');
        this.cameras.main.shake(250, 0.012);
        this.cameras.main.flash(150, 255, 60, 60);
        this.updateHud();
        if (this.lives <= 0) { this.gameOver(); return; }

        // reset positions, give the player a moment to breathe
        this.player.setPosition(this.spawns.player.x, this.spawns.player.y);
        this.player.setVelocity(0, 0);
        this.playerPath = null;
        this.marker.setVisible(false);
        this.invulnUntil = time + 2200;
        this.enemies.forEach(e => {
            e.sprite.setPosition(e.home.x, e.home.y);
            e.path = [];
            e.stunUntil = time + 1200;
        });
    }

    nextWave() {
        this.state = 'banner';
        this.wave++;
        this.sfx('wave');
        this.player.setVelocity(0, 0);
        this.playerPath = null;
        this.marker.setVisible(false);
        this.debugGfx.clear();
        const t = this.add.text(GAME_W / 2, GAME_H / 2, 'WAVE ' + this.wave, {
            fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: '#ffd166',
            stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5).setDepth(100).setScale(0.3);
        this.tweens.add({ targets: t, scale: 1, duration: 400, ease: 'Back.out' });
        this.time.delayedCall(1400, () => {
            t.destroy();
            this.enemies.forEach(e => {
                e.sprite.setPosition(e.home.x, e.home.y);
                e.path = [];
                e.stunUntil = this.time.now + 800;
            });
            this.player.setPosition(this.spawns.player.x, this.spawns.player.y);
            this.invulnUntil = this.time.now + 1500;
            this.spawnGems();
            this.updateHud();
            this.state = 'playing';
        });
    }

    gameOver() {
        this.state = 'over';
        this.overAt = this.time.now;
        this.player.setVelocity(0, 0);
        this.player.setAlpha(1);
        this.debugGfx.clear();
        this.sfx('gameover');

        const best = Math.max(safeGet('gemheist-best'), this.score);
        safeSet('gemheist-best', best);

        this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.65).setDepth(90);
        const style = (size, color) => ({
            fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold', color,
            stroke: '#000000', strokeThickness: 6
        });
        this.add.text(GAME_W / 2, 220, 'GAME OVER', style(64, '#ff6b6b')).setOrigin(0.5).setDepth(100);
        this.add.text(GAME_W / 2, 305, 'Score ' + this.score + '     Wave ' + this.wave, style(28, '#ffffff')).setOrigin(0.5).setDepth(100);
        this.add.text(GAME_W / 2, 345, 'Best ' + best, style(22, '#ffd166')).setOrigin(0.5).setDepth(100);
        const again = this.add.text(GAME_W / 2, 420, 'Click or press ENTER / R to play again', style(22, '#6ee7b7')).setOrigin(0.5).setDepth(100);
        this.tweens.add({ targets: again, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    }

    // ------------------------------------------------------------ debug: show EasyStar paths
    drawDebug() {
        const g = this.debugGfx;
        g.clear();
        if (!this.showPaths) return;
        const colors = { hunter: 0xff5555, ambusher: 0xffa040, thief: 0xc07aff };
        this.enemies.forEach(e => {
            if (!e.path.length) return;
            g.lineStyle(3, colors[e.type], 0.75);
            g.beginPath();
            g.moveTo(e.sprite.x, e.sprite.y);
            e.path.forEach(n => g.lineTo(n.x, n.y));
            g.strokePath();
            const last = e.path[e.path.length - 1];
            g.fillStyle(colors[e.type], 0.9);
            g.fillCircle(last.x, last.y, 5);
        });
        if (this.playerPath && this.playerPath.length) {
            g.lineStyle(2, 0xffffff, 0.5);
            g.beginPath();
            g.moveTo(this.player.x, this.player.y);
            this.playerPath.forEach(n => g.lineTo(n.x, n.y));
            g.strokePath();
        }
    }
}

// =====================================================================
//  PHASER CONFIG
// =====================================================================
const config = {
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H,
    backgroundColor: '#12161f',
    parent: document.body,
    pixelArt: true,
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [PreloadScene, MenuScene, GameScene]
};

const game = new Phaser.Game(config);
