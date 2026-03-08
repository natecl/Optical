/**
 * Component: ModeToggle
 * 
 * Description:
 *   Toggles the internal interaction state of the AI agent, such as switching from 
 *   "Standard Explanation Mode" to "Interactive Learning Mode" (where the AI quizzes the user).
 * 
 * Props:
 *   - currentMode (string): The active application mode.
 *   - onModeChange (callback): Fired when the user selects a new mode.
 */

import React from 'react';

interface ModeToggleProps {
    currentMode: string;
    onModeChange: (mode: string) => void;
}

export default function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
    return (
        <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
            <button
                onClick={() => onModeChange('standard')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${currentMode === 'standard' ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
            >
                Standard
            </button>
            <button
                onClick={() => onModeChange('learning')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${currentMode === 'learning' ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
            >
                Learning
            </button>
        </div>
    );
}
