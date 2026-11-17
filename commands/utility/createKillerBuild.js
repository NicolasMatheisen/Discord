import { ContainerBuilder, MessageFlags, SlashCommandBuilder, SeparatorSpacingSize } from 'discord.js';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const killersDir = path.join(process.cwd(), 'src', 'data', 'killers');
const offeringsFile = path.join(killersDir, 'killerOfferings.json');

const perkOptionNames = ['perk1', 'perk2', 'perk3', 'perk4'];
const addonOptionNames = ['addon1', 'addon2'];


async function loadKillers() {
	const files = (await readdir(killersDir))
		.filter((file) =>
			file.toLowerCase().endsWith('.json')
			&& file.toLowerCase() !== 'killerofferings.json',
		);

	const killers = [];

	for (const file of files) {
		const json = JSON.parse(
			await readFile(path.join(killersDir, file), 'utf8'),
		);

		for (const [key, data] of Object.entries(json)) {
			killers.push({
				id: key,
				name: data.name ?? key,
				data,
			});
		}
	}

	return killers;
}

async function loadOfferings() {
	const json = JSON.parse(await readFile(offeringsFile, 'utf8'));
	return json.offerings ?? [];
}

export const data = new SlashCommandBuilder()
	.setName('create-killer-build')
	.setDescription('Creates a killer build for Dead by Daylight')
	.addSubcommand((subcommand) =>
		subcommand
			.setName('build')
			.setDescription('Creates a build for the selected killer')
			.addStringOption((option) =>
				option
					.setName('killer')
					.setDescription('Select a killer')
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName('addon1')
					.setDescription('First add-on')
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName('addon2')
					.setDescription('Second add-on')
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName('perk1')
					.setDescription('First perk')
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName('perk2')
					.setDescription('Second perk')
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName('perk3')
					.setDescription('Third perk')
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName('perk4')
					.setDescription('Fourth perk')
					.setRequired(true)
					.setAutocomplete(true),
			)
			.addStringOption((option) =>
				option
					.setName('offering')
					.setDescription('Select an offering')
					.setRequired(true)
					.setAutocomplete(true),
			),
	);

export async function autocomplete(interaction) {
	try {
		const focused = interaction.options.getFocused(true);
		const query = String(focused.value).toLowerCase();
		const killers = await loadKillers();

		if (focused.name === 'killer') {
			const choices = killers
				.filter((killer) => killer.name.toLowerCase().includes(query))
				.slice(0, 25)
				.map((killer) => ({
					name: killer.name.slice(0, 100),
					value: killer.id,
				}));

			return interaction.respond(choices);
		}

		if (perkOptionNames.includes(focused.name)) {
			const perks = [
				...new Map(
					killers
						.flatMap((killer) => killer.data.unique_perks ?? [])
						.filter((perk) => perk.name)
						.map((perk) => [perk.name.toLowerCase(), perk.name]),
				).values(),
			];

			const selectedPerks = perkOptionNames
				.filter((optionName) => optionName !== focused.name)
				.map((optionName) => interaction.options.getString(optionName))
				.filter(Boolean)
				.map((perk) => perk.toLowerCase());

			const selectedPerksSet = new Set(selectedPerks);

			const choices = perks
				.filter((perk) =>
					perk.toLowerCase().includes(query)
					&& !selectedPerksSet.has(perk.toLowerCase()),
				)
				.slice(0, 25)
				.map((perk) => ({
					name: perk.slice(0, 100),
					value: perk,
				}));

			return interaction.respond(choices);
		}

		if (addonOptionNames.includes(focused.name)) {
			const killerId = interaction.options.getString('killer');
			const killer = killers.find((entry) => entry.id === killerId);

			if (!killer) {
				return interaction.respond([]);
			}

			const otherAddonOption =
				focused.name === 'addon1' ? 'addon2' : 'addon1';

			const selectedAddon = interaction.options
				.getString(otherAddonOption)
				?.toLowerCase();

			const choices = (killer.data.addons ?? [])
				.filter((addon) =>
					addon.name.toLowerCase().includes(query)
					&& addon.name.toLowerCase() !== selectedAddon,
				)
				.slice(0, 25)
				.map((addon) => ({
					name: addon.name.slice(0, 100),
					value: addon.name,
				}));

			return interaction.respond(choices);
		}

		if (focused.name === 'offering') {
			const offerings = await loadOfferings();

			const choices = offerings
				.filter((offering) =>
					offering.name.toLowerCase().includes(query),
				)
				.slice(0, 25)
				.map((offering) => ({
					name: offering.name.slice(0, 100),
					value: offering.name,
				}));

			return interaction.respond(choices);
		}

		return interaction.respond([]);
	}
	catch (error) {
		console.error('Autocomplete error:', error);

		await interaction.respond([]).catch((respondError) => {
			console.error('Could not respond to autocomplete:', respondError);
		});
	}
}

export async function execute(interaction) {
	const killers = await loadKillers();
	const offerings = await loadOfferings();

	const selectedKiller = interaction.options.getString('killer', true);
	const killer = killers.find((entry) => entry.id === selectedKiller);

	if (!killer) {
		return interaction.reply({
			content: 'Killer not found.',
			flags: MessageFlags.Ephemeral,
		});
	}

	const selectedPerks = perkOptionNames.map((optionName) =>
		interaction.options.getString(optionName, true),
	);

	const selectedAddons = addonOptionNames.map((optionName) =>
		interaction.options.getString(optionName, true),
	);

	const selectedOffering = interaction.options.getString('offering', true);

	const normalizedPerks = selectedPerks.map((perk) => perk.toLowerCase());

	if (new Set(normalizedPerks).size !== selectedPerks.length) {
		return interaction.reply({
			content: 'Its not allowed to select the same perk twice.',
			flags: MessageFlags.Ephemeral,
		});
	}

	const availablePerks = new Set(
		killers
			.flatMap((entry) => entry.data.unique_perks ?? [])
			.map((perk) => perk.name.toLowerCase()),
	);

	if (normalizedPerks.some((perk) => !availablePerks.has(perk))) {
		return interaction.reply({
			content: 'At least one selected perk is invalid.',
			flags: MessageFlags.Ephemeral,
		});
	}

	const normalizedAddons = selectedAddons.map((addon) => addon.toLowerCase());

	if (new Set(normalizedAddons).size !== selectedAddons.length) {
		return interaction.reply({
			content: 'Its not allowed to select the same addon twice.',
			flags: MessageFlags.Ephemeral,
		});
	}

	const killerAddons = killer.data.addons ?? [];
	const availableAddons = new Set(
		killerAddons.map((addon) => addon.name.toLowerCase()),
	);

	if (normalizedAddons.some((addon) => !availableAddons.has(addon))) {
		return interaction.reply({
			content: 'At least one selected addon does not belong to this killer.',
			flags: MessageFlags.Ephemeral,
		});
	}

	const offering = offerings.find(
		(entry) => entry.name.toLowerCase() === selectedOffering.toLowerCase(),
	);

	if (!offering) {
		return interaction.reply({
			content: 'Offering nicht gefunden.',
			flags: MessageFlags.Ephemeral,
		});
	}

	const perkText = selectedPerks
		.map((perk, index) => `**${index + 1}.** ${perk}`)
		.join('\n');

	const addonText = selectedAddons
		.map((addon, index) => `**${index + 1}.** ${addon}`)
		.join('\n');

	const container = new ContainerBuilder()
		.setAccentColor(0x8b0000)
		.addTextDisplayComponents((text) =>
			text.setContent(
				`# ${killer.name} — Killer Build`,
			),
		)
		.addSeparatorComponents((separator) =>
			separator
				.setDivider(true)
				.setSpacing(SeparatorSpacingSize.Small),
		)
		.addTextDisplayComponents((text) =>
			text.setContent(
				`### POWER\n${killer.data.power || 'No power specified'}`,
			),
		)
		.addSeparatorComponents((separator) =>
			separator
				.setDivider(true)
				.setSpacing(SeparatorSpacingSize.Small),
		)
		.addTextDisplayComponents((text) =>
			text.setContent(`### PERKS\n${perkText}`),
		)
		.addTextDisplayComponents((text) =>
			text.setContent(`### ADD-ONS\n${addonText}`),
		)
		.addSeparatorComponents((separator) =>
			separator
				.setDivider(true)
				.setSpacing(SeparatorSpacingSize.Small),
		)
		.addTextDisplayComponents((text) =>
			text.setContent(`### OFFERING\n${offering.name}`),
		);

	return interaction.reply({
		flags: MessageFlags.IsComponentsV2,
		components: [container],
	});

}
