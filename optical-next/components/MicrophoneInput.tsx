/**
 * Component: MicrophoneInput
 * 
 * Description:
 *   Captures user voice input for processing by the conversational AI.
 *   Streams audio chunks via WebSocket or Web Audio API to the backend.
 * 
 * Props:
 *   - isListening (boolean): State determining if audio is actively captured.
 *   - onAudioData (optional callback): Executed whenever an audio chunk is available.
 */

import { useState } from 'react';

export default function MicrophoneInput() {
    const [isListening, setIsListening] = useState(false);

    const toggleMic = () => {
        setIsListening(prev => !prev);
        // Boilerplate logic for audio stream start/stop
    };

    return (
        <button
            onClick={toggleMic}
            className={`p-4 rounded-full transition-all duration-300 ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'} text-white shadow-lg`}
        >
            {isListening ? 'Stop Listening' : 'Start Listening'}
        </button>
    );
}
