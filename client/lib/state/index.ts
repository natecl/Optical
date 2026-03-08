/**
 * Lib: state utils
 * 
 * Description:
 *   Manages the transient application state such as memory of what object the 
 *   user is currently discussing, past questions, and UI state tracking.
 */

export const convoState = {
    history: [],
    currentObjectContext: null,
};
