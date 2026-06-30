// Keyboard + mouse, gamepad, and mobile touch controls.
export class Input {
  constructor(domElement) {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pointerLocked = false;
    this.justPressed = new Set();

    this.touchAxis = { x: 0, y: 0 };
    this.touchHeld = new Set();
    this.touchPressed = new Set();
    this.runToggled = false;
    this._touchUiPointers = new Set();
    this._lookPointer = null;
    this._lookLast = null;
    this._joyPointer = null;
    this._joyCenter = { x: 0, y: 0 };
    this._joyRadius = 52;
    this.touchControlsEnabled = this._wantsTouchControls();

    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    domElement.addEventListener('click', () => {
      if (this.touchControlsEnabled) return;
      if (!this.pointerLocked) domElement.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === domElement;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });

    if (this.touchControlsEnabled) {
      this._disableMobileZoom();
      this._setupTouchControls(domElement);
    }
  }

  down(code) { return this.keys.has(code); }
  pressed(code) { return this.justPressed.has(code); }

  _wantsTouchControls() {
    return window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 920;
  }

  _disableMobileZoom() {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 350) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
    for (const eventName of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(eventName, (e) => e.preventDefault(), { passive: false });
    }
  }

  _pressTouch(name) {
    if (!this.touchHeld.has(name)) this.touchPressed.add(name);
    this.touchHeld.add(name);
  }

  _releaseTouch(name) {
    this.touchHeld.delete(name);
  }

  _requestSpecial(type) {
    const p = window.__player;
    if (!p || (p.powerCounts?.[type] || 0) < 3) return false;
    p.lastPower = type;
    window.__specialTypeRequest = type;
    this._pressTouch('special-' + type);
    return true;
  }

  _setupTouchControls(domElement) {
    document.body.classList.add('mobile-controls-enabled');

    const root = document.createElement('div');
    root.id = 'mobileControls';
    root.innerHTML = `
      <div class="mobile-joy" aria-label="Mover">
        <div class="mobile-joy-knob"></div>
      </div>
      <div class="mobile-actions" aria-label="Acoes">
        <button class="mobile-btn mobile-btn-special mobile-btn-special-blue" data-action="special-speed" type="button">AZUL</button>
        <button class="mobile-btn mobile-btn-special mobile-btn-special-red" data-action="special-kick" type="button">VERM.</button>
        <button class="mobile-btn mobile-btn-special mobile-btn-special-green" data-action="special-jump" type="button">VERDE</button>
        <button class="mobile-btn mobile-btn-small" data-action="run" type="button">RUN</button>
        <button class="mobile-btn" data-action="jump" type="button">SALTAR</button>
        <button class="mobile-btn mobile-btn-kick" data-action="attack" type="button">CHUTAR</button>
      </div>
    `;
    document.body.appendChild(root);

    const joy = root.querySelector('.mobile-joy');
    const knob = root.querySelector('.mobile-joy-knob');

    const updateSpecialButtons = () => {
      const p = window.__player;
      const cfg = {
        speed: ['#2f7be0', 'AZUL'],
        kick: ['#e8323f', 'VERM.'],
        jump: ['#27c24a', 'VERDE'],
      };
      for (const [type, [color, label]] of Object.entries(cfg)) {
        const btn = root.querySelector(`[data-action="special-${type}"]`);
        if (!btn) continue;
        const count = p?.powerCounts?.[type] || 0;
        btn.textContent = `${label} ${count}/3`;
        if (count >= 3) {
          btn.style.opacity = '.94';
          btn.style.borderColor = '#ffffffcc';
          btn.style.background = `radial-gradient(circle at 35% 24%, #ffffff55, #ffffff00 28%), linear-gradient(180deg, ${color}, ${color}88)`;
          btn.style.boxShadow = `0 0 18px ${color}, 0 8px 18px #0007`;
        } else {
          btn.style.opacity = '.34';
          btn.style.borderColor = '#ffffff33';
          btn.style.background = 'linear-gradient(180deg,#2b385a55,#11182b44)';
          btn.style.boxShadow = '0 8px 18px #0005, inset 0 4px 12px #ffffff12, inset 0 -8px 14px #0005';
        }
      }
    };
    setInterval(updateSpecialButtons, 150);
    updateSpecialButtons();

    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._touchUiPointers.add(e.pointerId);
    };
    const resetJoy = () => {
      this._joyPointer = null;
      this.touchAxis.x = 0;
      this.touchAxis.y = 0;
      knob.style.transform = 'translate(-50%, -50%)';
      joy.classList.remove('is-active');
    };
    const moveJoy = (e) => {
      const dx = e.clientX - this._joyCenter.x;
      const dy = e.clientY - this._joyCenter.y;
      const len = Math.hypot(dx, dy);
      const scale = len > this._joyRadius ? this._joyRadius / len : 1;
      const kx = dx * scale;
      const ky = dy * scale;
      this.touchAxis.x = kx / this._joyRadius;
      this.touchAxis.y = ky / this._joyRadius;
      knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    };

    joy.addEventListener('pointerdown', (e) => {
      stop(e);
      this._joyPointer = e.pointerId;
      joy.setPointerCapture?.(e.pointerId);
      const rect = joy.getBoundingClientRect();
      this._joyCenter.x = rect.left + rect.width / 2;
      this._joyCenter.y = rect.top + rect.height / 2;
      joy.classList.add('is-active');
      moveJoy(e);
    });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._joyPointer) return;
      stop(e);
      moveJoy(e);
    });
    joy.addEventListener('pointerup', (e) => {
      if (e.pointerId !== this._joyPointer) return;
      stop(e);
      resetJoy();
    });
    joy.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== this._joyPointer) return;
      this._touchUiPointers.delete(e.pointerId);
      resetJoy();
    });

    for (const btn of root.querySelectorAll('.mobile-btn')) {
      btn.addEventListener('pointerdown', (e) => {
        stop(e);
        btn.setPointerCapture?.(e.pointerId);
        const action = btn.dataset.action;
        if (action === 'run') {
          this.runToggled = !this.runToggled;
          btn.classList.toggle('is-active', this.runToggled);
          return;
        }
        if (action === 'jump') this._pressTouch('jump');
        if (action === 'attack') this._pressTouch('attack');
        if (action === 'special-speed') this._requestSpecial('speed');
        if (action === 'special-kick') this._requestSpecial('kick');
        if (action === 'special-jump') this._requestSpecial('jump');
        btn.classList.add('is-active');
      });
      const release = (e) => {
        stop(e);
        const action = btn.dataset.action;
        if (action !== 'run') btn.classList.remove('is-active');
        if (action === 'jump') this._releaseTouch('jump');
        if (action === 'attack') this._releaseTouch('attack');
        if (action === 'special-speed') this._releaseTouch('special-speed');
        if (action === 'special-kick') this._releaseTouch('special-kick');
        if (action === 'special-jump') this._releaseTouch('special-jump');
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    }

    domElement.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || this._touchUiPointers.has(e.pointerId)) return;
      if (e.clientX < window.innerWidth * 0.35) return;
      e.preventDefault();
      this._lookPointer = e.pointerId;
      this._lookLast = { x: e.clientX, y: e.clientY };
      domElement.setPointerCapture?.(e.pointerId);
    }, { passive: false });
    domElement.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._lookPointer || !this._lookLast) return;
      e.preventDefault();
      this.mouseDX += e.clientX - this._lookLast.x;
      this.mouseDY += e.clientY - this._lookLast.y;
      this._lookLast.x = e.clientX;
      this._lookLast.y = e.clientY;
    }, { passive: false });
    const endLook = (e) => {
      if (e.pointerId === this._lookPointer) {
        this._lookPointer = null;
        this._lookLast = null;
      }
      this._touchUiPointers.delete(e.pointerId);
    };
    domElement.addEventListener('pointerup', endLook);
    domElement.addEventListener('pointercancel', endLook);
    window.addEventListener('blur', () => {
      resetJoy();
      this.touchHeld.clear();
      this.touchPressed.clear();
    });
  }

  axis() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;

    const gp = navigator.getGamepads?.()[0];
    if (gp) {
      if (Math.abs(gp.axes[0]) > 0.15) x += gp.axes[0];
      if (Math.abs(gp.axes[1]) > 0.15) y += gp.axes[1];
    }
    x += this.touchAxis.x;
    y += this.touchAxis.y;
    return { x, y };
  }

  jump() {
    const gp = navigator.getGamepads?.()[0];
    return this.pressed('Space') || this.touchPressed.has('jump') ||
      (gp && gp.buttons[0]?.pressed && !this._gpJumpHeld && (this._gpJumpHeld = true)) || false;
  }

  action() {
    return this.pressed('KeyE') || this.pressed('Enter');
  }

  attack() {
    const gp = navigator.getGamepads?.()[0];
    return this.pressed('ControlLeft') || this.pressed('ControlRight') || this.pressed('KeyX') ||
      this.touchPressed.has('attack') ||
      (gp && gp.buttons[2]?.pressed && !this._gpAtkHeld && (this._gpAtkHeld = true)) || false;
  }

  _keyboardSpecial(type) {
    const p = window.__player;
    if (!p || (p.powerCounts?.[type] || 0) < 3) return false;
    p.lastPower = type;
    window.__specialTypeRequest = type;
    return true;
  }

  special() {
    const gp = navigator.getGamepads?.()[0];
    if (this.pressed('Digit1')) return this._keyboardSpecial('speed');
    if (this.pressed('Digit2')) return this._keyboardSpecial('kick');
    if (this.pressed('Digit3')) return this._keyboardSpecial('jump');
    if (this.touchPressed.has('special-speed') || this.touchPressed.has('special-kick') || this.touchPressed.has('special-jump')) return true;
    return this.pressed('KeyF') ||
      (gp && gp.buttons[3]?.pressed && !this._gpSpecialHeld && (this._gpSpecialHeld = true)) || false;
  }

  cameraToggle() {
    return false;
  }

  sprint() {
    const gp = navigator.getGamepads?.()[0];
    return this.runToggled || this.down('ShiftLeft') || this.down('ShiftRight') || (gp && gp.buttons[1]?.pressed) || false;
  }

  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.justPressed.clear();
    this.touchPressed.clear();
    const gp = navigator.getGamepads?.()[0];
    if (gp && !gp.buttons[0]?.pressed) this._gpJumpHeld = false;
    if (gp && !gp.buttons[2]?.pressed) this._gpAtkHeld = false;
    if (gp && !gp.buttons[3]?.pressed) this._gpSpecialHeld = false;
  }
}
