export const COMBO_CONFIG = {
    MULTIPLIER_INCREMENT: 0.1,
    MAX_MULTIPLIER: 3.0,
    BASE_MULTIPLIER: 1.0,
    MAX_COMBO_COUNT: 20,
    RESET_MULTIPLIER: 1.0,
    RESET_COMBO: 0,
};
export function calculateComboMultiplier(combo: number, config: any = COMBO_CONFIG): number {
    const increment = config.MULTIPLIER_INCREMENT || config.multiplierIncrement || 0.1;
    const base = config.BASE_MULTIPLIER || config.baseMultiplier || 1.0;
    const maxMultiplierLimit = config.MAX_MULTIPLIER || config.maxMultiplier || 3.0;
    const calculatedMultiplier = base + combo * increment;
    return Math.min(calculatedMultiplier, maxMultiplierLimit);
}
export function getWinComboState(currentCombo: number, currentMaxCombo: number, config: any = COMBO_CONFIG): {
    newCombo: number;
    newMaxCombo: number;
    newMultiplier: number;
} {
    const maxComboLimit = config.MAX_COMBO_COUNT || config.maxComboCount || 20;
    const newCombo = Math.min(currentCombo + 1, maxComboLimit);
    const newMaxCombo = Math.max(currentMaxCombo, newCombo);
    const newMultiplier = calculateComboMultiplier(newCombo, config);
    return { newCombo, newMaxCombo, newMultiplier };
}
export function getLoseComboState(config: typeof COMBO_CONFIG = COMBO_CONFIG): {
    newCombo: number;
    newMultiplier: number;
} {
    return {
        newCombo: config.RESET_COMBO,
        newMultiplier: config.RESET_MULTIPLIER,
    };
}
export function getDrawComboState(currentCombo: number, currentMultiplier: number): {
    newCombo: number;
    newMultiplier: number;
} {
    return {
        newCombo: currentCombo,
        newMultiplier: currentMultiplier,
    };
}
export function getComboStateByResult(result: 'WIN' | 'LOSE' | 'DRAW' | 'REFUND' | 'BREAKEVEN', currentCombo: number, currentMaxCombo: number, currentMultiplier: number = 1.0, config: typeof COMBO_CONFIG = COMBO_CONFIG): {
    newCombo: number;
    newMaxCombo: number;
    newMultiplier: number;
} {
    switch (result) {
        case 'WIN':
            return getWinComboState(currentCombo, currentMaxCombo, config);
        case 'LOSE':
            const loseState = getLoseComboState(config);
            return { ...loseState, newMaxCombo: currentMaxCombo };
        case 'DRAW':
        case 'REFUND':
        case 'BREAKEVEN':
            const drawState = getDrawComboState(currentCombo, currentMultiplier);
            return { ...drawState, newMaxCombo: currentMaxCombo };
        default:
            return { newCombo: currentCombo, newMaxCombo: currentMaxCombo, newMultiplier: currentMultiplier };
    }
}
