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

    if (this.touchControlsEnabled) this._setupTouchControls(domElement);
  }

  down(code) { return this.keys.has(code); }
  pressed(code) { return this.justPressed.has(code); }

  _wantsTouchControls() {
    return window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 920;
  }

  _pressTouch(name) {
    if (!this.touchHeld.has(name)) this.touchPressed.add(name);
    this.touchHeld.add(name);
  }

  _releaseTouch(name) {
    this.touchHeld.delete(name);
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
        <button class="mobile-btn mobile-btn-small" data-action="run" type="button">RUN</button>
        <button class="mobile-btn" data-action="jump" type="button">SALTAR</button>
        <button class="mobile-btn mobile-btn-kick" data-action="attack" type="button">CHUTAR</button>
      </div>
    `;
    document.body.appendChild(root);

    const joy = root.querySelector('.mobile-joy');
    const knob = root.querySelector('.mobile-joy-knob');

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
        btn.classList.add('is-active');
      });
      const release = (e) => {
        stop(e);
        const action = btn.dataset.action;
        if (action !== 'run') btn.classList.remove('is-active');
        if (action === 'jump') this._releaseTouch('jump');
        if (action === 'attack') this._releaseTouch('attack');
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
  }
}
