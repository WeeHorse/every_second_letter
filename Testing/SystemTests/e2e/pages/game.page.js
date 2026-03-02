import {expect} from "@playwright/test";

export default class GamePage {
    constructor(page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/');
    }

    async startNewGame() {
        await this.page.getByTestId('start-game').click();
    }

    async expectGameCreated() {
        await expect(this.page.getByTestId('game-id')).toBeVisible();
    }
}

