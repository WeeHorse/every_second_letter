import { expect } from "@playwright/test";

export default class GamePage {
    constructor(page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/');
    }

    async startNewGame() {
        await this.page.locator('#createBtn').click();
    }

    async expectGameCreated() {
        await expect(this.page.locator('#game')).toBeVisible();
        await expect(this.page.locator('#gameIdGameOut')).not.toHaveText('-');
    }
}
