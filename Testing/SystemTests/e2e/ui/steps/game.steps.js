import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();

import GamePage from "../pages/game.page.js";


Given('att jag är på startsidan', async ({ page }) => {
    const game = new GamePage(page);
    await game.goto();
});

When('jag startar ett nytt spel', async ({ page }) => {
    const game = new GamePage(page);
    await game.startNewGame();
});

Then('ska jag se att spelet är skapat', async ({ page }) => {
    const game = new GamePage(page);
    await game.expectGameCreated();
});