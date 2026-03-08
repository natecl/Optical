/**
 * Component: TranscriptPanel
 * 
 * Description:
 *   Displays the conversation history between the user and the AI agent in real-time.
 *   Renders user questions and AI responses/explanations.
 * 
 * Props:
 *   - history (Array): List of message objects { sender: 'user' | 'agent', text: string }.
 */

interface Message {
    sender: 'user' | 'agent';
    text: string;
}

interface TranscriptPanelProps {
    history?: Message[];
}

export default function TranscriptPanel({ history = [] }: TranscriptPanelProps) {
    return (
        <div className="w-full h-64 overflow-y-auto bg-black/60 backdrop-blur-md rounded-xl p-4 border border-white/10 flex flex-col gap-3">
            {history.length === 0 ? (
                <p className="text-white/40 text-center italic mt-auto mb-auto">No transcript yet. Ask a question.</p>
            ) : (
                history.map((msg, idx) => (
                    <div key={idx} className={`max-w-[80%] rounded-lg p-3 ${msg.sender === 'user' ? 'bg-blue-600 self-end text-white' : 'bg-white/10 self-start text-white/90'}`}>
                        {msg.text}
                    </div>
                ))
            )}
        </div>
    );
}
