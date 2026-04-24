const gameArea = document.getElementById("gameArea");
const basket = document.getElementById("basket");
const scoreDisplay = document.getElementById("score");
const levelDisplay = document.getElementById("level");
const livesDisplay = document.getElementById("lives");
const highScoreDisplay = document.getElementById("highScore");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const pauseScreen = document.getElementById("pauseScreen");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const pauseButton = document.getElementById("pauseButton");
const closePauseButton = document.getElementById("closePauseButton");
const resumeButton = document.getElementById("resumeButton");
const pauseRestartButton = document.getElementById("pauseRestartButton");
const soundToggleButton = document.getElementById("soundToggleButton");
const volumeSlider = document.getElementById("volumeSlider");
const finalScoreDisplay = document.getElementById("finalScore");

const startingLives = 3;
const basketSpeed = 8;
const itemSize = 42;
const highScoreKey = "cookie-catcher-high-score-v1";
const backgroundMelody = [523, 659, 784, 659, 587, 698, 880, 698];
const itemTypes = [
  { symbol: "🍪", score: 1, chance: 0.36 },
  { symbol: "🍔", score: 3, chance: 0.17 },
  { symbol: "🧋", score: 5, chance: 0.09 },
  { symbol: "🔥", score: -1, chance: 0.20 },
  { symbol: "💣", score: -3, chance: 0.11 },
  { symbol: "🦠", score: -5, chance: 0.07 }
];

let score = 0;
let lives = startingLives;
let highScore = Number(localStorage.getItem(highScoreKey)) || 0;
let basketX = 0;
let moveLeft = false;
let moveRight = false;
let fallingItems = [];
let animationFrameId = null;
let lastFrameTime = 0;
let lastSpawnTime = 0;
let gameStartTime = 0;
let gameRunning = false;
let gamePaused = false;
let soundEnabled = true;
let masterVolume = Number(volumeSlider.value) / 100;
let audioContext = null;
let backgroundMusicTimer = null;
let backgroundMusicStep = 0;

highScoreDisplay.textContent = highScore;

function resetGame() {
  score = 0;
  lives = startingLives;
  clearFallingItems();

  const areaWidth = gameArea.clientWidth;
  const basketWidth = basket.offsetWidth;
  basketX = (areaWidth - basketWidth) / 2;
  basket.style.left = `${basketX}px`;
  basket.style.transform = "none";

  updateStats();
  finalScoreDisplay.textContent = score;
}

function startGame() {
  cancelAnimationFrame(animationFrameId);
  stopBackgroundMusic();
  backgroundMusicStep = 0;
  resetGame();
  gameRunning = true;
  gamePaused = false;
  lastFrameTime = performance.now();
  lastSpawnTime = lastFrameTime;
  gameStartTime = lastFrameTime;

  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");

  startBackgroundMusic();
  animationFrameId = requestAnimationFrame(updateGame);
}

function endGame() {
  gameRunning = false;
  gamePaused = false;
  cancelAnimationFrame(animationFrameId);
  stopBackgroundMusic();
  clearFallingItems();

  if (score > highScore) {
    highScore = score;
    localStorage.setItem(highScoreKey, highScore);
    highScoreDisplay.textContent = highScore;
  }

  finalScoreDisplay.textContent = score;
  pauseScreen.classList.add("hidden");
  gameOverScreen.classList.remove("hidden");
}

function updateGame(currentTime) {
  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;

  moveBasket();
  spawnItems(currentTime);
  moveFallingItems(deltaTime, currentTime);

  if (gameRunning && !gamePaused) {
    animationFrameId = requestAnimationFrame(updateGame);
  }
}

function pauseGame() {
  if (!gameRunning || gamePaused) {
    return;
  }

  gamePaused = true;
  moveLeft = false;
  moveRight = false;
  cancelAnimationFrame(animationFrameId);
  stopBackgroundMusic();
  pauseScreen.classList.remove("hidden");
}

function resumeGame() {
  if (!gameRunning || !gamePaused) {
    return;
  }

  gamePaused = false;
  lastFrameTime = performance.now();
  lastSpawnTime = lastFrameTime;
  pauseScreen.classList.add("hidden");
  startBackgroundMusic();
  animationFrameId = requestAnimationFrame(updateGame);
}

function togglePause() {
  if (gamePaused) {
    resumeGame();
    return;
  }

  pauseGame();
}

function moveBasket() {
  // Arrow keys change these two booleans, and the game loop applies movement every frame.
  if (moveLeft) {
    basketX -= basketSpeed;
  }

  if (moveRight) {
    basketX += basketSpeed;
  }

  const maxBasketX = gameArea.clientWidth - basket.offsetWidth;
  basketX = Math.max(0, Math.min(basketX, maxBasketX));
  basket.style.left = `${basketX}px`;
}

function spawnItems(currentTime) {
  const elapsedSeconds = (currentTime - gameStartTime) / 1000;
  const level = getLevel();
  const spawnInterval = Math.max(500, 1350 - (level - 1) * 90 - elapsedSeconds * 5);

  if (currentTime - lastSpawnTime < spawnInterval) {
    return;
  }

  lastSpawnTime = currentTime;

  const itemElement = document.createElement("div");
  const itemType = getRandomItemType();
  const isBad = itemType.score < 0;
  const maxX = gameArea.clientWidth - itemSize;
  const x = Math.random() * maxX;
  const baseSpeed = 80 + (level - 1) * 18 + elapsedSeconds * 1.5;
  const randomSpeedBonus = Math.random() * (35 + level * 4);

  itemElement.className = `falling-item ${isBad ? "bad" : "good"}`;
  itemElement.textContent = itemType.symbol;
  itemElement.style.transform = `translate(${x}px, -${itemSize}px)`;
  gameArea.appendChild(itemElement);

  fallingItems.push({
    element: itemElement,
    x,
    y: -itemSize,
    speed: baseSpeed + randomSpeedBonus,
    score: itemType.score
  });
}

function moveFallingItems(deltaTime, currentTime) {
  for (let index = fallingItems.length - 1; index >= 0; index -= 1) {
    const item = fallingItems[index];
    item.y += item.speed * (deltaTime / 1000);
    item.element.style.transform = `translate(${item.x}px, ${item.y}px)`;

    if (isCatchingItem(item)) {
      const shouldEndGame = handleCatch(item);
      removeItem(index);

      if (shouldEndGame) {
        endGame();
        return;
      }

      continue;
    }

    if (item.y > gameArea.clientHeight) {
      removeItem(index);
    }
  }

  // Existing items gently speed up too, so the ramp feels smooth instead of jumpy.
  const elapsedSeconds = (currentTime - gameStartTime) / 1000;
  const level = getLevel();
  fallingItems.forEach((item) => {
    item.speed += (level * 0.0008 + elapsedSeconds * 0.0003) * deltaTime;
  });
}

function isCatchingItem(item) {
  // Collision is checked by comparing the item's rectangle with the basket's rectangle.
  const basketRect = {
    left: basketX,
    right: basketX + basket.offsetWidth,
    top: gameArea.clientHeight - 78,
    bottom: gameArea.clientHeight - 20
  };

  const itemRect = {
    left: item.x,
    right: item.x + itemSize,
    top: item.y,
    bottom: item.y + itemSize
  };

  return (
    itemRect.right > basketRect.left &&
    itemRect.left < basketRect.right &&
    itemRect.bottom > basketRect.top &&
    itemRect.top < basketRect.bottom
  );
}

function handleCatch(item) {
  score += item.score;

  if (item.score > 0) {
    updateStats();
    playPositiveSound();
    flashBasket("hit-good");
    return false;
  }

  lives -= 1;
  updateStats();
  playNegativeSound();
  flashBasket("hit-bad");

  return lives <= 0;
}

function getLevel() {
  // Every 5 points raises the level, which makes new items fall a bit faster.
  return Math.max(1, Math.floor(score / 5) + 1);
}

function updateStats() {
  scoreDisplay.textContent = score;
  levelDisplay.textContent = getLevel();
  livesDisplay.textContent = lives;
}

function getRandomItemType() {
  // Each item has a chance value. Higher chance means it appears more often.
  const randomNumber = Math.random();
  let chanceTotal = 0;

  for (const itemType of itemTypes) {
    chanceTotal += itemType.chance;

    if (randomNumber <= chanceTotal) {
      return itemType;
    }
  }

  return itemTypes[0];
}

function removeItem(index) {
  fallingItems[index].element.remove();
  fallingItems.splice(index, 1);
}

function clearFallingItems() {
  fallingItems.forEach((item) => item.element.remove());
  fallingItems = [];
}

function flashBasket(className) {
  basket.classList.add(className);

  setTimeout(() => {
    basket.classList.remove(className);
  }, 140);
}

function getAudioContext() {
  // Web Audio starts after a player action, so no external sound files are needed.
  if (!soundEnabled) {
    return null;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function startBackgroundMusic() {
  if (!gameRunning || gamePaused || backgroundMusicTimer || !soundEnabled) {
    return;
  }

  playBackgroundMusicNote();
  backgroundMusicTimer = setInterval(playBackgroundMusicNote, 390);
}

function stopBackgroundMusic() {
  clearInterval(backgroundMusicTimer);
  backgroundMusicTimer = null;
}

function playBackgroundMusicNote() {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const note = backgroundMelody[backgroundMusicStep % backgroundMelody.length];
  backgroundMusicStep += 1;

  playTone(note, 0.18, "triangle", 0.018);

  if (backgroundMusicStep % 2 === 0) {
    playTone(note / 2, 0.22, "sine", 0.012);
  }
}

function playPositiveSound() {
  playTone(784, 0.08, "sine", 0.06);
  setTimeout(() => playTone(1046, 0.09, "sine", 0.055), 70);
}

function playNegativeSound() {
  playTone(185, 0.11, "sawtooth", 0.055);
  setTimeout(() => playTone(123, 0.15, "square", 0.045), 80);
}

function playTone(frequency, duration, type, volume) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const adjustedVolume = volume * masterVolume;

  if (adjustedVolume <= 0) {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.frequency.value = frequency;
  oscillator.type = type;
  gain.gain.setValueAtTime(adjustedVolume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    togglePause();
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveLeft = true;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveRight = true;
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveLeft = false;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveRight = false;
  }
});

window.addEventListener("resize", () => {
  const maxBasketX = gameArea.clientWidth - basket.offsetWidth;
  basketX = Math.max(0, Math.min(basketX, maxBasketX));
  basket.style.left = `${basketX}px`;
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
closePauseButton.addEventListener("click", resumeGame);
resumeButton.addEventListener("click", resumeGame);
pauseRestartButton.addEventListener("click", startGame);
soundToggleButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggleButton.textContent = soundEnabled ? "ON" : "OFF";
  soundToggleButton.classList.toggle("is-off", !soundEnabled);
  soundToggleButton.classList.toggle("is-on", soundEnabled);

  if (soundEnabled) {
    startBackgroundMusic();
    return;
  }

  stopBackgroundMusic();
});

volumeSlider.addEventListener("input", () => {
  masterVolume = Number(volumeSlider.value) / 100;
  volumeSlider.style.setProperty("--volume-percent", `${volumeSlider.value}%`);
});

volumeSlider.style.setProperty("--volume-percent", `${volumeSlider.value}%`);
