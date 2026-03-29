import { expect } from "@playwright/test";

export default class GamePage {
    constructor(page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/');
    }

    async registerIfNeeded(playerName = 'Player') {
        const registerPage = this.page.getByTestId('register-page');
        if (await registerPage.isVisible()) {
            await this.page.getByTestId('player-name-input').fill(playerName);
            await this.page.getByTestId('register-continue').click();
        }
    }

    async startNewGame(playerName = 'Player 1') {
        await this.registerIfNeeded(playerName);
        await expect(this.page.getByTestId('create-page')).toBeVisible();
        await this.page.getByTestId('create-game-btn').click();
        await expect(this.page.getByTestId('game-waiting-card')).toBeVisible();
    }

    async expectGameCreated() {
        await expect(this.page.getByTestId('game-waiting-card')).toBeVisible();
        await expect(this.page.getByTestId('game-id-text')).not.toHaveText('');
    }

    async expectGameActive() {
        await expect(this.page.getByTestId('game-active-card')).toBeVisible();
    }

    async getGameId() {
        const text = await this.page.getByTestId('game-id-text').textContent();
        return (text || '').trim();
    }

    async getStatus() {
        const elem = await this.page.getByTestId('game-status');
        return (await elem.textContent())?.trim();
    }

    async getPlayer1Score() {
        const elem = await this.page.getByTestId('score-player-1-value');
        return parseInt(await elem.textContent(), 10);
    }

    async getPlayer1Label() {
        const elem = this.page.getByTestId('score-player-1').locator('.player-name');
        return ((await elem.textContent()) || '').trim();
    }

    async getPlayer2Score() {
        const elem = await this.page.getByTestId('score-player-2-value');
        return parseInt(await elem.textContent(), 10);
    }

    async getPlayer2Label() {
        const elem = this.page.getByTestId('score-player-2').locator('.player-name');
        return ((await elem.textContent()) || '').trim();
    }

    async getAcceptButtonText() {
        const elem = await this.page.getByTestId('accept-btn');
        return (await elem.textContent()) || '';
    }

    async getDisputeButtonText() {
        const elem = await this.page.getByTestId('dispute-btn');
        return (await elem.textContent()) || '';
    }

    async playLetter(letter) {
        await expect(this.page.getByTestId('letter-input')).toBeVisible();
        await this.page.getByTestId('letter-input').fill(letter);
        await this.page.getByTestId('play-btn').click();
    }

    async claimWord() {
        await this.page.getByTestId('claim-btn').click();
    }

    async acceptClaim() {
        await this.page.getByTestId('accept-btn').click();
    }

    async disputeClaim() {
        await this.page.getByTestId('dispute-btn').click();
    }

    async isClaimButtonVisible() {
        return await this.page.getByTestId('claim-btn').isVisible();
    }

    async isAcceptButtonDisabled() {
        return await this.page.getByTestId('accept-btn').isDisabled();
    }

    async isDisputeButtonDisabled() {
        return await this.page.getByTestId('dispute-btn').isDisabled();
    }

    async getWordTiles() {
        const tiles = await this.page.getByTestId('word-tile').count();
        const letters = [];
        for (let i = 0; i < tiles; i++) {
            const text = await this.page.getByTestId('word-tile').nth(i).textContent();
            letters.push((text || '').trim());
        }
        return letters.join('');
    }

    async waitForWordTiles(expectedWord, timeoutMs = 5000) {
        await expect
            .poll(async () => this.getWordTiles(), { timeout: timeoutMs })
            .toBe(expectedWord);
    }

    async getPendingWordText() {
        const text = await this.page.getByTestId('pending-word').textContent();
        return (text || '').trim();
    }

    async getCurrentWordCountText() {
        const text = await this.page.getByTestId('word-count').textContent();
        return (text || '').trim();
    }

    async joinGameById(gameId, playerName = 'Player 2') {
        await this.registerIfNeeded(playerName);
        const joinPageVisible = await this.page.getByTestId('join-page').isVisible();
        if (!joinPageVisible) {
            await this.page.getByTestId('toggle-join').click();
        }
        await expect(this.page.getByTestId('join-page')).toBeVisible();
        await this.page.getByTestId('join-game-id-input').fill(gameId);
        await this.page.getByTestId('join-game-btn').click();
    }

    async refreshPage() {
        await this.page.reload();
    }

    async waitForStatus(expectedStatus, timeoutMs = 15000) {
        await expect(this.page.getByTestId('game-status')).toHaveText(expectedStatus, { timeout: timeoutMs });
    }

    async pollForGameStatus(expectedStatus, timeoutMs = 10000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getStatus();
            if (status === expectedStatus) return true;
            await this.page.waitForTimeout(100);
        }
        return false;
    }
}
