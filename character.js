// ==========================================
// 11종 젤리 캐릭터 데이터 및 3D 모델 클래스
// ==========================================
const CHARACTER_TYPES = [
    { id: 'chameleon', name: '카멜레온', emoji: '🦎', defaultColor: 0x2ed573 },
    { id: 'mountain',  name: '산',       emoji: '⛰️', defaultColor: 0x778beb },
    { id: 'horse',     name: '말',       emoji: '🐴', defaultColor: 0xcd6133 },
    { id: 'pig',       name: '돼지',     emoji: '🐷', defaultColor: 0xff9ff3 },
    { id: 'dino',      name: '공룡',     emoji: '🦖', defaultColor: 0x20bf6b },
    { id: 'mouse',     name: '쥐',       emoji: '🐭', defaultColor: 0xa4b0be },
    { id: 'monkey',    name: '원숭이',   emoji: '🐵', defaultColor: 0xb33939 },
    { id: 'bear',      name: '곰',       emoji: '🐻', defaultColor: 0x845422 },
    { id: 'pigeon',    name: '비둘기',   emoji: '🕊️', defaultColor: 0x70a1ff },
    { id: 'chicken',   name: '닭',       emoji: '🐔', defaultColor: 0xffffff },
    { id: 'owl',       name: '올빼미',   emoji: '🦉', defaultColor: 0x6D4C41 }
];

const JELLY_COLORS = [
    { name: '민트 그린', hex: 0x2ed573, css: '#2ed573' },
    { name: '코랄 레드', hex: 0xff4757, css: '#ff4757' },
    { name: '스카이 블루', hex: 0x1e90ff, css: '#1e90ff' },
    { name: '레몬 옐로우', hex: 0xffa502, css: '#ffa502' },
    { name: '피치 핑크', hex: 0xff9ff3, css: '#ff9ff3' },
    { name: '라벤더 퍼플', hex: 0x9c88ff, css: '#9c88ff' },
    { name: '테라코타', hex: 0xcd6133, css: '#cd6133' },
    { name: '초코 브라운', hex: 0x845422, css: '#845422' },
    { name: '스노우 화이트', hex: 0xffffff, css: '#ffffff' },
    { name: '차콜 그레이', hex: 0x57606f, css: '#57606f' }
];

class JellyCharacter {
    constructor(type = 'chameleon', colorHex = 0x2ed573, x = 0, z = 6, nickname = '카멜레온', targetParent = null) {
        this.type = type;
        this.colorHex = colorHex;
        this.nickname = nickname;
        this.parentObj = targetParent || lobbyGroup || scene;
        this.group = new THREE.Group();
        this.group.position.set(x, 0, z);

        this.velocity = new THREE.Vector3();
        this.isGrounded = true;
        this.walkTime = 0;
        this.isShoving = false;
        this.shoveTimer = 0;

        this.buildMesh();
        this.createNameTag(nickname);
        this.parentObj.add(this.group);
    }

    createNameTag(name) {
        if (this.nameSprite) this.group.remove(this.nameSprite);
        const displayName = (name && name.trim()) ? name.trim() : CHARACTER_TYPES.find(c => c.id === this.type).name;
        this.nickname = displayName;

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.font = '900 48px "Fredoka", "Noto Sans KR", sans-serif';
        const textWidth = ctx.measureText(displayName).width;
        const pillWidth = Math.min(480, Math.max(180, textWidth + 72));
        const pillHeight = 84;
        const px = (512 - pillWidth) / 2;
        const py = (128 - pillHeight) / 2;

        ctx.fillStyle = 'rgba(20, 26, 46, 0.78)';
        this.roundRect(ctx, px, py, pillWidth, pillHeight, 42);
        ctx.fill();

        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        this.roundRect(ctx, px, py, pillWidth, pillHeight, 42);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayName, 256, 66);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        this.nameSprite = new THREE.Sprite(mat);
        this.nameSprite.scale.set(2.4, 0.6, 1);
        this.nameSprite.position.set(0, 2.55, 0);
        this.group.add(this.nameSprite);
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    setNickname(name) { this.createNameTag(name); }

    buildMesh() {
        this.jellyMat = new THREE.MeshPhysicalMaterial({
            color: this.colorHex, roughness: 0.25, metalness: 0.05, clearcoat: 0.85, clearcoatRoughness: 0.15
        });
        const bellyMat = new THREE.MeshStandardMaterial({ color: 0xeafff2, roughness: 0.5 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
        const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff8da1, roughness: 0.4 });
        const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffd32a, roughness: 0.3 });
        const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff7f50, roughness: 0.35 });
        const redMat = new THREE.MeshStandardMaterial({ color: 0xff4757, roughness: 0.35 });
        const brownMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.6 });

        this.bodyPivot = new THREE.Group();
        this.group.add(this.bodyPivot);

        if (this.type === 'mountain') {
            const mMesh = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.35, 7), this.jellyMat);
            mMesh.position.y = 0.72;
            mMesh.castShadow = true;
            const capMesh = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.56, 7), whiteMat);
            capMesh.position.y = 1.15;
            this.bodyPivot.add(mMesh, capMesh);
        } else {
            const bodyGeo = new THREE.SphereGeometry(0.62, 24, 24);
            bodyGeo.scale(0.95, 1.15, 0.88);
            const bodyMesh = new THREE.Mesh(bodyGeo, this.jellyMat);
            bodyMesh.position.y = 0.72;
            bodyMesh.castShadow = true;
            const bellyGeo = new THREE.SphereGeometry(0.45, 16, 16);
            bellyGeo.scale(0.85, 0.95, 0.4);
            const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
            bellyMesh.position.set(0, 0.68, 0.43);
            this.bodyPivot.add(bodyMesh, bellyMesh);
        }

        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 1.45, 0.05);
        this.bodyPivot.add(this.headGroup);

        if (this.type !== 'mountain') {
            const headGeo = new THREE.SphereGeometry(0.55, 24, 24);
            headGeo.scale(1.12, 0.92, 1.05);
            const headMesh = new THREE.Mesh(headGeo, this.jellyMat);
            headMesh.castShadow = true;
            this.headGroup.add(headMesh);
        }

        const addStandardEyes = (y = 0.08, xOff = 0.25, zOff = 0.48, scale = 1.0) => {
            [-1, 1].forEach(side => {
                const eyeGroup = new THREE.Group();
                eyeGroup.position.set(side * xOff, y, zOff);
                const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 16, 16), whiteMat);
                const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08 * scale, 12, 12), darkMat);
                pupil.position.z = 0.09 * scale;
                eyeGroup.add(sclera, pupil);
                this.headGroup.add(eyeGroup);
            });
        };

        switch (this.type) {
            case 'chameleon': {
                [-1, 1].forEach(side => {
                    const eyeGroup = new THREE.Group();
                    eyeGroup.position.set(side * 0.48, 0.06, 0.25);
                    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), whiteMat);
                    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), darkMat);
                    pupil.position.set(side * 0.05, 0, 0.16);
                    eyeGroup.add(sclera, pupil);
                    this.headGroup.add(eyeGroup);
                });
                for (let i = 0; i < 3; i++) {
                    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), yellowMat);
                    spike.position.set(0, 0.45 - i * 0.12, -0.15 - i * 0.22);
                    spike.rotation.x = -0.35 * (i + 1);
                    this.headGroup.add(spike);
                }
                break;
            }
            case 'mountain': {
                addStandardEyes(-0.35, 0.22, 0.48, 0.9);
                const miniPeak = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 6), this.jellyMat);
                miniPeak.position.set(0.45, -0.85, 0.15);
                this.headGroup.add(miniPeak);
                break;
            }
            case 'horse': {
                addStandardEyes(0.12, 0.32, 0.42, 0.95);
                const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.45, 16), bellyMat);
                snout.rotation.x = Math.PI / 2.2;
                snout.position.set(0, -0.06, 0.56);
                this.headGroup.add(snout);
                [-1, 1].forEach(side => {
                    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), this.jellyMat);
                    ear.position.set(side * 0.28, 0.55, -0.05);
                    ear.rotation.z = -side * 0.2;
                    this.headGroup.add(ear);
                });
                for (let i = 0; i < 4; i++) {
                    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.24), brownMat);
                    mane.position.set(0, 0.48 - i * 0.24, -0.38 - i * 0.06);
                    mane.rotation.x = -0.3;
                    this.headGroup.add(mane);
                }
                break;
            }
            case 'pig': {
                addStandardEyes(0.12, 0.28, 0.46, 0.95);
                const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.16, 16), pinkMat);
                nose.rotation.x = Math.PI / 2;
                nose.position.set(0, -0.04, 0.56);
                this.headGroup.add(nose);
                [-1, 1].forEach(side => {
                    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), darkMat);
                    nostril.position.set(side * 0.08, -0.04, 0.64);
                    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 8), this.jellyMat);
                    ear.position.set(side * 0.36, 0.42, 0.14);
                    ear.rotation.set(0.55, 0, -side * 0.45);
                    this.headGroup.add(nostril, ear);
                });
                break;
            }
            case 'dino': {
                addStandardEyes(0.14, 0.32, 0.44, 1.0);
                const dinoSnout = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), this.jellyMat);
                dinoSnout.scale.set(1.05, 0.72, 1.15);
                dinoSnout.position.set(0, -0.05, 0.48);
                this.headGroup.add(dinoSnout);
                [-1, 1].forEach(side => {
                    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), darkMat);
                    nostril.position.set(side * 0.11, 0.04, 0.8);
                    this.headGroup.add(nostril);
                });
                const spineCoords = [
                    { y: 1.96, z: -0.05, rx: -0.2, s: 1.0 },
                    { y: 1.72, z: -0.45, rx: -0.75, s: 1.1 },
                    { y: 1.25, z: -0.58, rx: -1.35, s: 1.15 },
                    { y: 0.80, z: -0.62, rx: -1.55, s: 1.0 },
                    { y: 0.48, z: -0.92, rx: -1.15, s: 0.8 }
                ];
                spineCoords.forEach(sp => {
                    const plate = new THREE.Mesh(new THREE.ConeGeometry(0.11 * sp.s, 0.26 * sp.s, 6), yellowMat);
                    plate.position.set(0, sp.y, sp.z);
                    plate.rotation.x = sp.rx;
                    this.bodyPivot.add(plate);
                });
                break;
            }
            case 'mouse': {
                addStandardEyes(0.08, 0.24, 0.48, 0.9);
                const snout = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.34, 16), this.jellyMat);
                snout.rotation.x = Math.PI / 2;
                snout.position.set(0, -0.06, 0.62);
                const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), pinkMat);
                tip.position.set(0, -0.06, 0.78);
                this.headGroup.add(snout, tip);
                [-1, 1].forEach(side => {
                    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), this.jellyMat);
                    ear.rotation.x = Math.PI / 2;
                    ear.position.set(side * 0.46, 0.44, 0.0);
                    const innerEar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.09, 16), pinkMat);
                    innerEar.rotation.x = Math.PI / 2;
                    innerEar.position.set(side * 0.46, 0.44, 0.01);
                    this.headGroup.add(ear, innerEar);
                });
                break;
            }
            case 'monkey': {
                const facePlate = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), bellyMat);
                facePlate.scale.set(1.05, 0.88, 0.5);
                facePlate.position.set(0, -0.04, 0.41);
                const mouthMuzzle = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), bellyMat);
                mouthMuzzle.scale.set(1.15, 0.78, 0.75);
                mouthMuzzle.position.set(0, -0.15, 0.54);
                this.headGroup.add(facePlate, mouthMuzzle);
                addStandardEyes(0.1, 0.18, 0.57, 0.85);
                [-1, 1].forEach(side => {
                    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), this.jellyMat);
                    ear.scale.set(0.9, 0.9, 0.4);
                    ear.position.set(side * 0.58, 0.05, 0.02);
                    this.headGroup.add(ear);
                });
                break;
            }
            case 'bear': {
                addStandardEyes(0.1, 0.25, 0.48, 0.9);
                const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), bellyMat);
                muzzle.scale.set(1.15, 0.88, 0.75);
                muzzle.position.set(0, -0.08, 0.52);
                const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), darkMat);
                nose.position.set(0, -0.01, 0.67);
                this.headGroup.add(muzzle, nose);
                [-1, 1].forEach(side => {
                    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), this.jellyMat);
                    ear.position.set(side * 0.42, 0.44, 0.02);
                    const innerBearEar = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), bellyMat);
                    innerBearEar.position.set(side * 0.42, 0.44, 0.12);
                    this.headGroup.add(ear, innerBearEar);
                });
                break;
            }
            case 'pigeon': {
                addStandardEyes(0.1, 0.28, 0.45, 0.9);
                const beak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 8), orangeMat);
                beak.rotation.x = Math.PI / 2;
                beak.position.set(0, -0.02, 0.62);
                const cere = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), whiteMat);
                cere.scale.set(1.2, 0.7, 0.8);
                cere.position.set(0, 0.05, 0.53);
                this.headGroup.add(beak, cere);
                break;
            }
            case 'chicken': {
                addStandardEyes(0.1, 0.28, 0.45, 0.9);
                const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 8), yellowMat);
                beak.rotation.x = Math.PI / 2;
                beak.position.set(0, -0.02, 0.62);
                this.headGroup.add(beak);
                for (let i = 0; i < 3; i++) {
                    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.11 - i * 0.015, 10, 10), redMat);
                    comb.scale.set(0.6, 1.25, 1.0);
                    comb.position.set(0, 0.52 - i * 0.03, 0.14 - i * 0.16);
                    this.headGroup.add(comb);
                }
                const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), redMat);
                wattle.scale.set(0.8, 1.3, 0.8);
                wattle.position.set(0, -0.18, 0.52);
                this.headGroup.add(wattle);
                break;
            }
            case 'owl': {
                [-1, 1].forEach(side => {
                    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 18), bellyMat);
                    disc.rotation.x = Math.PI / 2;
                    disc.position.set(side * 0.24, 0.08, 0.49);
                    this.headGroup.add(disc);
                });
                addStandardEyes(0.08, 0.24, 0.52, 1.15);
                const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), yellowMat);
                beak.rotation.x = Math.PI / 1.7;
                beak.position.set(0, -0.05, 0.58);
                this.headGroup.add(beak);
                [-1, 1].forEach(side => {
                    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 6), this.jellyMat);
                    tuft.position.set(side * 0.36, 0.46, 0.05);
                    tuft.rotation.z = -side * 0.35;
                    this.headGroup.add(tuft);
                });
                break;
            }
        }

        const isBird = ['pigeon', 'chicken', 'owl'].includes(this.type);
        const armGeo = isBird ? new THREE.SphereGeometry(0.22, 14, 14) : new THREE.CylinderGeometry(0.11, 0.11, 0.4, 12);
        if (isBird) armGeo.scale(0.55, 1.45, 1.15);

        this.leftArm = new THREE.Mesh(armGeo, this.jellyMat);
        this.leftArm.position.set(-0.62, 0.85, 0.05);
        this.leftArm.rotation.z = 0.4;
        this.bodyPivot.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo, this.jellyMat);
        this.rightArm.position.set(0.62, 0.85, 0.05);
        this.rightArm.rotation.z = -0.4;
        this.bodyPivot.add(this.rightArm);

        const legGeo = new THREE.CylinderGeometry(0.13, 0.14, 0.35, 12);
        const legMat = isBird ? orangeMat : this.jellyMat;
        this.leftLeg = new THREE.Mesh(legGeo, legMat);
        this.leftLeg.position.set(-0.25, 0.2, 0);
        this.rightLeg = new THREE.Mesh(legGeo, legMat);
        this.rightLeg.position.set(0.25, 0.2, 0);
        this.group.add(this.leftLeg, this.rightLeg);

        if (this.type === 'chameleon') {
            this.tail = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 12, 24, Math.PI * 1.5), this.jellyMat);
            this.tail.position.set(0, 0.45, -0.58);
            this.tail.rotation.y = Math.PI / 2;
            this.bodyPivot.add(this.tail);
        } else if (this.type === 'dino') {
            this.tail = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.82, 12), this.jellyMat);
            this.tail.position.set(0, 0.48, -0.78);
            this.tail.rotation.x = -Math.PI / 2.4;
            this.bodyPivot.add(this.tail);
        } else if (this.type === 'pig') {
            this.tail = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 10, 20, Math.PI * 1.7), this.jellyMat);
            this.tail.position.set(0, 0.56, -0.56);
            this.bodyPivot.add(this.tail);
        } else if (this.type === 'horse') {
            this.tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 10), brownMat);
            this.tail.position.set(0, 0.52, -0.62);
            this.tail.rotation.x = -2.4;
            this.bodyPivot.add(this.tail);
        } else if (['mouse', 'monkey'].includes(this.type)) {
            const tailCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(0, 0.45, -0.5),
                new THREE.Vector3(0, 0.65, -0.82),
                new THREE.Vector3(0.15, 0.9, -0.95)
            ]);
            this.tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 12, 0.04, 8, false), this.type === 'mouse' ? pinkMat : this.jellyMat);
            this.bodyPivot.add(this.tail);
        } else if (this.type !== 'mountain') {
            this.tail = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), isBird ? this.jellyMat : whiteMat);
            this.tail.position.set(0, 0.48, -0.56);
            this.bodyPivot.add(this.tail);
        }
    }

    setAppearance(type, colorHex) {
        this.type = type;
        this.colorHex = colorHex;
        const savedPos = this.group.position.clone();
        const savedRot = this.group.rotation.clone();
        const savedName = this.nickname;
        this.parentObj.remove(this.group);

        this.group = new THREE.Group();
        this.group.position.copy(savedPos);
        this.group.rotation.copy(savedRot);
        this.buildMesh();
        this.createNameTag(savedName);
        this.parentObj.add(this.group);
    }

    setColor(colorHex) {
        this.colorHex = colorHex;
        if (this.jellyMat) this.jellyMat.color.setHex(colorHex);
    }

    jump() {
        if (this.isGrounded) {
            this.velocity.y = 8.8;
            this.isGrounded = false;
        }
    }

    shove() {
        if (this.isShoving) return;
        this.isShoving = true;
        this.shoveTimer = 0.34;
        const forward = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
        this.velocity.x += forward.x * 5.2;
        this.velocity.z += forward.z * 5.2;
        const wavePos = this.group.position.clone().add(new THREE.Vector3(0, 0.9, 0)).add(forward.clone().multiplyScalar(0.95));
        spawnShoveWave(wavePos, this.group.rotation.y);
    }

    update(dt, moveDir) {
        const moveSpeed = 6.2;
        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            this.velocity.x = moveDir.x * moveSpeed;
            this.velocity.z = moveDir.z * moveSpeed;
            const targetAngle = Math.atan2(moveDir.x, moveDir.z);
            let diff = targetAngle - this.group.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.group.rotation.y += diff * 12 * dt;
            this.walkTime += dt * 14;
        } else {
            this.velocity.x *= 0.8;
            this.velocity.z *= 0.8;
            this.walkTime = 0;
        }

        this.velocity.y -= 20 * dt;
        const prevY = this.group.position.y;
        this.group.position.x += this.velocity.x * dt;
        this.group.position.z += this.velocity.z * dt;
        this.group.position.y += this.velocity.y * dt;

        const charRadius = 0.62;
        let floorY = 0;
        for (let i = 0; i < colliders.length; i++) {
            const col = colliders[i];
            const dx = this.group.position.x - col.x;
            const dz = this.group.position.z - col.z;
            const distSq = dx * dx + dz * dz;
            const minDist = charRadius + col.r;

            if (distSq < minDist * minDist) {
                if (col.height !== undefined && prevY >= col.height - 0.12 && this.velocity.y <= 0) {
                    floorY = Math.max(floorY, col.height);
                } else if (col.height === undefined || this.group.position.y < col.height - 0.12) {
                    const dist = Math.sqrt(distSq) || 0.001;
                    const overlap = minDist - dist;
                    this.group.position.x += (dx / dist) * overlap;
                    this.group.position.z += (dz / dist) * overlap;
                }
            }
        }

        if (this.group.position.y <= floorY) {
            this.group.position.y = floorY;
            this.velocity.y = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }

        const maxBound = 24;
        this.group.position.x = Math.max(-maxBound, Math.min(maxBound, this.group.position.x));
        this.group.position.z = Math.max(-maxBound, Math.min(maxBound, this.group.position.z));

        if (this.isShoving) {
            this.shoveTimer -= dt;
            const progress = 1 - Math.max(0, this.shoveTimer / 0.34);
            const punchCurve = Math.sin(progress * Math.PI);
            this.bodyPivot.rotation.x = punchCurve * 0.42;
            this.bodyPivot.position.z = punchCurve * 0.24;
            this.leftArm.rotation.x = -punchCurve * 1.45;
            this.rightArm.rotation.x = -punchCurve * 1.45;
            this.leftArm.rotation.z = 0.4 - punchCurve * 0.35;
            this.rightArm.rotation.z = -0.4 + punchCurve * 0.35;
            this.leftArm.position.z = 0.05 + punchCurve * 0.38;
            this.rightArm.position.z = 0.05 + punchCurve * 0.38;
            this.bodyPivot.scale.set(1 - punchCurve * 0.12, 1 - punchCurve * 0.08, 1 + punchCurve * 0.22);

            if (this.shoveTimer <= 0) {
                this.isShoving = false;
                this.bodyPivot.rotation.x = 0;
                this.bodyPivot.position.z = 0;
                this.leftArm.rotation.x = 0;
                this.rightArm.rotation.x = 0;
                this.leftArm.rotation.z = 0.4;
                this.rightArm.rotation.z = -0.4;
                this.leftArm.position.z = 0.05;
                this.rightArm.position.z = 0.05;
                this.bodyPivot.scale.set(1, 1, 1);
            }
        } else if (moveDir.lengthSq() > 0 && this.isGrounded) {
            const bounce = Math.abs(Math.sin(this.walkTime));
            this.bodyPivot.position.y = bounce * 0.15;
            this.bodyPivot.scale.set(1 + bounce * 0.08, 1 - bounce * 0.1, 1 + bounce * 0.08);
            this.leftLeg.position.z = Math.sin(this.walkTime) * 0.2;
            this.rightLeg.position.z = -Math.sin(this.walkTime) * 0.2;
            this.leftArm.rotation.x = -Math.sin(this.walkTime) * 0.5;
            this.rightArm.rotation.x = Math.sin(this.walkTime) * 0.5;
        } else {
            const idleWave = Math.sin(clock.getElapsedTime() * 3) * 0.03;
            this.bodyPivot.position.y = idleWave;
            this.bodyPivot.scale.set(1 - idleWave, 1 + idleWave, 1 - idleWave);
            this.leftLeg.position.z = 0;
            this.rightLeg.position.z = 0;
        }
    }
}