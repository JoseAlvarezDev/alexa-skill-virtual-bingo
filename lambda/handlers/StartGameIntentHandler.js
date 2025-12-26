const Alexa = require('ask-sdk-core');
const { createNewGame, drawNumber, createNumberAnnouncement } = require('../utils/gameLogic');
const { saveGameState } = require('../utils/persistence');

const StartGameIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StartGameIntent';
    },
    async handle(handlerInput) {
        const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;

        // Obtener la velocidad solicitada o usar 'normal' por defecto
        const speed = Alexa.getSlotValue(requestEnvelope, 'speed') || 'normal';

        // Crear nuevo juego
        const gameState = createNewGame(speed);

        // Mensajes según la velocidad
        const speedMessages = {
            lento: 'modo lento, con 5 segundos entre cada bola',
            normal: 'modo normal, con 3 segundos entre cada bola',
            rápido: 'modo rápido, con un segundo y medio entre cada bola',
            turbo: 'modo turbo, ¡con solo un segundo entre cada bola!'
        };
        const speedMsg = speedMessages[speed] || speedMessages.normal;

        let speakOutput = `<amazon:emotion name="excited" intensity="high">
            ¡Bienvenidos al Virtual Bingo Show!
            <break time="500ms"/>
            Iniciando partida en ${speedMsg}
            <break time="700ms"/>
            ¡Preparen sus cartones! El juego comienza en 3... 2... 1...
            <break time="800ms"/>
        </amazon:emotion>`;

        // --- LÓGICA DE AUTOPLAY (BATCHING) ---
        const pauseTimes = {
            lento: '5s',
            normal: '3s',
            rápido: '1500ms',
            turbo: '1s'
        };
        const pauseTime = pauseTimes[speed] || '3s';

        let numbersInBatch = 0;
        const BATCH_SIZE = 40;

        speakOutput += `<amazon:emotion name="excited" intensity="medium">`;

        while (numbersInBatch < BATCH_SIZE) {
            const newNumber = drawNumber(gameState.calledNumbers);

            // No debería pasar que se acaben nada más empezar, pero por seguridad:
            if (newNumber === null) {
                break;
            }

            // Añadir número al estado
            gameState.calledNumbers.push(newNumber);
            gameState.lastNumber = newNumber;

            // Crear anuncio
            const announcement = createNumberAnnouncement(newNumber, true);

            // Construir SSML
            speakOutput += `${announcement}. <break time="${pauseTime}"/> `;

            // Update cada 10 bolas
            if (gameState.calledNumbers.length % 10 === 0) {
                speakOutput += `Llevamos ${gameState.calledNumbers.length} bolas. <break time="1s"/> `;
            }

            numbersInBatch++;
        }

        speakOutput += `</amazon:emotion>`;

        // Guardar estado con los números ya generados
        await saveGameState(attributesManager, gameState);

        // Mensaje final del batch si quedan números
        if (gameState.active && gameState.calledNumbers.length < 90) { // Asumiendo 90 bolas
            const numbersLeft = 90 - gameState.calledNumbers.length;
            speakOutput += ` He cantado los primeros números. Di "sigue" para continuar.`;
        }

        return responseBuilder
            .speak(speakOutput)
            .reprompt('Di "sigue" para continuar cantando números, o "pausa" para detener.')
            .getResponse();
    }
};

module.exports = StartGameIntentHandler;
