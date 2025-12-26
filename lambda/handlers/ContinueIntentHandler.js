const Alexa = require('ask-sdk-core');
const { drawNumber, createNumberAnnouncement } = require('../utils/gameLogic');
const { getGameState, saveGameState } = require('../utils/persistence');

const ContinueIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.ResumeIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'ContinueIntent');
    },
    async handle(handlerInput) {
        const { attributesManager, responseBuilder } = handlerInput;

        // Obtener estado del juego
        const gameState = await getGameState(attributesManager);

        if (!gameState || !gameState.active) {
            return responseBuilder
                .speak('No hay ninguna partida activa. Di "nueva partida" para comenzar.')
                .reprompt('Di "nueva partida" para comenzar a jugar.')
                .getResponse();
        }

        // Reanudar el juego
        gameState.paused = false;

        // Configuración de pausas según velocidad
        const pauseTimes = {
            lento: '5s',
            normal: '3s',
            rápido: '1500ms',
            turbo: '1s'
        };
        const pauseTime = pauseTimes[gameState.speed] || '3s';

        // Generar secuencia de números (BATCH)
        // Alexa tiene un límite de tiempo de respuesta. 
        // Generamos un lote de 40 números o hasta terminar.
        // Esto cubre varios minutos de juego continuo.
        let speakOutput = '';
        let numbersInBatch = 0;
        const BATCH_SIZE = 40;

        // Emoción inicial
        speakOutput += `<amazon:emotion name="excited" intensity="medium">`;

        while (numbersInBatch < BATCH_SIZE) {
            const newNumber = drawNumber(gameState.calledNumbers);

            if (newNumber === null) {
                // Se acabaron los números en medio del batch
                speakOutput += `¡Y eso es todo! Se han cantado todos los números. La partida ha terminado.</amazon:emotion>`;
                gameState.active = false;
                await saveGameState(attributesManager, gameState);

                return responseBuilder
                    .speak(speakOutput)
                    .reprompt('Di "nueva partida" para jugar otra vez.')
                    .getResponse();
            }

            // Añadir número al estado
            gameState.calledNumbers.push(newNumber);
            gameState.lastNumber = newNumber;

            // Crear anuncio
            const announcement = createNumberAnnouncement(newNumber, true);

            // Construir SSML para este número
            speakOutput += `${announcement}. <break time="${pauseTime}"/> `;

            // Añadir feedback cada 10 números para mantener al usuario orientado
            if (gameState.calledNumbers.length % 10 === 0) {
                speakOutput += `Van ${gameState.calledNumbers.length} bolas. <break time="1s"/> `;
            }

            numbersInBatch++;
        }

        speakOutput += `</amazon:emotion>`;

        // Guardar estado actualizado
        await saveGameState(attributesManager, gameState);

        // Si salimos del bucle es porque llegamos al límite del batch (pero quedan números)
        // Añadimos un prompt final para continuar
        const numbersLeft = 90 - gameState.calledNumbers.length; // Asumiendo bingo 90

        speakOutput += ` He cantado una ronda larga. Quedan ${numbersLeft} números. Di "sigue" para continuar.`;

        return responseBuilder
            .speak(speakOutput)
            .reprompt('Di "sigue" para continuar cantando números.')
            .getResponse();
    }
};

module.exports = ContinueIntentHandler;
