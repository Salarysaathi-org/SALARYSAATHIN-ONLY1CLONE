export function generateRandomWord() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let randomWord = "";
    for (let i = 0; i < 6; i++) {
        // Adjust length as needed
        randomWord += letters.charAt(
            Math.floor(Math.random() * letters.length)
        );
    }
    return `FATHER_${randomWord}`;
}
