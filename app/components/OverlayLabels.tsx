/**
 * Component: OverlayLabels
 * 
 * Description:
 *   Renders bounding boxes, points of interest, and textual labels directly on top
 *   of the camera feed, providing augmented reality (AR) style context to the user.
 * 
 * Props:
 *   - objects (Array): List of detected objects with bounding box coordinates and labels.
 */

import React from 'react';

export default function OverlayLabels({ objects = [] }) {
    return (
        <div className="absolute inset-0 pointer-events-none">
            {objects.map((obj, idx) => (
                <div
                    key={idx}
                    className="absolute border-2 border-green-500 rounded bg-black/40 text-green-400 text-xs font-bold px-1"
                    style={{
                        top: `${obj.y}%`,
                        left: `${obj.x}%`,
                        width: `${obj.width}%`,
                        height: `${obj.height}%`
                    }}
                >
                    {obj.label}
                </div>
            ))}
        </div>
    );
}
