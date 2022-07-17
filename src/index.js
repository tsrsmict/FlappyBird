import './main.scss';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './game/constants';
import Pipe from './game/pipe';
import Bird from './game/bird';
import Floor from './game/floor';
import Text from './game/gameText';
import Button from './game/gameButton';
import P5 from 'p5';
import Images from './assets/sprite.png';
import BackgroundImage from './assets/background.png';
import font from './assets/FlappyBirdy.ttf';
import Storage from './storage';

var audioContext = null;
var meter = null;


function createAudioMeter(audioContext,clipLevel,averaging,clipLag) {
	var processor = audioContext.createScriptProcessor(512);
	processor.onaudioprocess = volumeAudioProcess;
	processor.clipping = false;
	processor.lastClip = 0;
	processor.volume = 0;
	processor.clipLevel = clipLevel || 0.98;
	processor.averaging = averaging || 0.95;
	processor.clipLag = clipLag || 750;

	// this will have no effect, since we don't copy the input to the output,
	// but works around a current Chrome bug.
	processor.connect(audioContext.destination);

	processor.checkClipping =
		function(){
			if (!this.clipping)
				return false;
			if ((this.lastClip + this.clipLag) < window.performance.now())
				this.clipping = false;
			return this.clipping;
		};

	processor.shutdown =
		function(){
			this.disconnect();
			this.onaudioprocess = null;
		};

	return processor;
}

function volumeAudioProcess( event ) {
	var buf = event.inputBuffer.getChannelData(0);
    var bufLength = buf.length;
	var sum = 0;
    var x;

	// Do a root-mean-square on the samples: sum up the squares...
    for (var i=0; i<bufLength; i++) {
    	x = buf[i];
    	if (Math.abs(x)>=this.clipLevel) {
    		this.clipping = true;
    		this.lastClip = window.performance.now();
    	}
    	sum += x * x;
    }

    // ... then take the square root of the sum.
    var rms =  Math.sqrt(sum / bufLength);

    // Now smooth this out with the averaging factor applied
    // to the previous sample - take the max here because we
    // want "fast attack, slow release."
    this.volume = Math.max(rms, this.volume*this.averaging);
}


window.onclick = function() {
    console.log('Calling onclick function');

	
    // monkeypatch Web Audio
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
	
    // grab an audio context
    audioContext = new AudioContext();

    // Attempt to get audio input
    try {
        // monkeypatch getUserMedia
        navigator.getUserMedia = 
        	navigator.getUserMedia ||
        	navigator.webkitGetUserMedia ||
        	navigator.mozGetUserMedia;

        // ask for an audio input
        navigator.getUserMedia(
        {
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream, didntGetStream);
    } catch (e) {
        alert('getUserMedia threw exception :' + e);
    }

}


function didntGetStream() {
    alert('Stream generation failed.');
}

var mediaStreamSource = null;

function gotStream(stream) {
    console.log('Getting stream');
    // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);

    // Create a new volume meter and connect it.
    meter = createAudioMeter(audioContext, 0.98, 0);
    mediaStreamSource.connect(meter);
    console.log('Initialised meter');
}


const sketch = p5 => {
    let background = p5.loadImage(BackgroundImage);
    let spriteImage = p5.loadImage(Images);
    let birdyFont = p5.loadFont(font);
    let gameStart;
    let gameOver;
    let bird;
    let pipe;
    let floor;
    let gameButton;
    let gameText;
    let score;
    let storage;
    let bestScore;

    const resetGame = () => {
        gameStart = false;
        gameOver = false;
        bird = new Bird(p5, spriteImage);
        pipe = new Pipe(p5, spriteImage);
        floor = new Floor(p5, spriteImage);
        gameText = new Text(p5, birdyFont);
        gameButton = new Button(p5, gameText, spriteImage);
        storage = new Storage();
        score = 0;
        pipe.generateFirst();
        bird.draw();
        floor.draw();
        let dataFromStorage = storage.getStorageData();
        
        if (dataFromStorage === null) {
            bestScore = 0;
        }
        else {
            bestScore = dataFromStorage.bestScore;
        }
    }

    const canvasClick = () => {
        if (p5.mouseButton === 'left') {
            if (gameOver === false)
                console.log(meter.volume)
                bird.jump();
            if (gameStart === false)
                gameStart = true;
            if (gameOver &&
                p5.mouseX > CANVAS_WIDTH / 2 - 85 &&
                p5.mouseX < CANVAS_WIDTH / 2 + 75 &&
                p5.mouseY > CANVAS_HEIGHT / 2 + 100 &&
                p5.mouseY < CANVAS_HEIGHT / 2 + 160
            )
                resetGame();
        }
    }

    const canvasTouch = () => {
        
        if (gameOver === false)
            bird.jump();
        if (gameStart === false)
            gameStart = true;
    }

    p5.setup = () => {
        console.log('Setting up');
        var canvas = p5.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        canvas.mousePressed(canvasClick);
        canvas.touchStarted(canvasTouch);
        resetGame();
    }

    p5.draw = () => {
        p5.image(background, 0, 0);

        if (gameStart && gameOver === false) {
            pipe.move();
            pipe.draw();

            bird.update();
            bird.draw();

            floor.update();
            floor.draw();

            gameOver = pipe.checkCrash(bird) || bird.isDead();

            if (pipe.getScore(bird))
                score++;
        }
        else {
            pipe.draw();
            bird.draw();
            floor.draw();
            if (gameOver)
                bird.update();
            else {
                floor.update();
            }
        }


        if (gameStart === false) {
            gameText.startText();
        }

        if (gameOver) {
            if (score > bestScore) {
                bestScore = score;
                storage.setStorageData({ bestScore: score });
            }

            gameText.gameOverText(score, bestScore);

            gameButton.resetButton();
        }
        else {
            gameText.scoreText(score);

        }
    }



    p5.keyPressed = (e) => {
        if (e.key === ' ') {
            if (gameOver === false)
                bird.jump();
            if (gameStart === false)
                gameStart = true;
        }
        if (e.key === 'r') {
            if (gameOver) {
                resetGame();
            }
        }
    }

    window.setInterval(function(){
        console.log('Calling interval function');
        console.log(meter);
        console.log(meter.volume);
        if (meter.volume > 0.05) {
            bird.jump();
        }
    }, 50);
}

new P5(sketch, 'Game');
