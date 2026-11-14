import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
	.setName('ping')
	.setDescription('Antwortet mit Pong!');

export const cooldown = 5;

export async function execute(interaction) {
	await interaction.reply('Pong!');
}
