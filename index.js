const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

console.log("VGPL Kooperations-Bot wird geladen...");

// Bot-Client initialisieren
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// EXAKTE KANAL- UND KATEGORIE-KONFIGURATION
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    PANEL_CHANNEL_ID: '1527714318752415844', // Hier öffnet der User das Ticket
    CATEGORY_ID: '1527713678101844030', // Hier erscheinen die Kooperations-Tickets
    ADMIN_CHAT_CHANNEL_ID: '1527715001681576166', // Admin-Kanal für Freigaben
    ADMIN_ROLE_NAME: 'Admin', // Genauer Name der Admin-Rolle
    HEAD_ADMIN_ROLE_NAME: 'Head Admin' // Genauer Name der Head-Admin-Rolle
};

// Globaler In-Memory-Speicher zur Verknüpfung von Admin-Nachrichten und privaten Tickets
const activeCooperations = new Map();

// Dummy-Webserver für Render (Keep-Alive)
if (process.env.PORT || 3000) {
    const http = require('http');
    const port = process.env.PORT || 3000;
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('VGPL Germany Kooperations-Bot laeuft online!\n');
    }).listen(port, () => {
        console.log(`Webserver aktiv auf Port ${port}`);
    });
}

// Event: Bot startet erfolgreich
client.once('ready', async () => {
    console.log(`Kooperations-Bot eingeloggt als ${client.user.tag}!`);

    try {
        const panelChannel = await client.channels.fetch(CONFIG.PANEL_CHANNEL_ID);
        if (panelChannel) {
            // Verlauf prüfen, um doppelte Panels zu verhindern
            const messages = await panelChannel.messages.fetch({ limit: 10 });
            const hasPanel = messages.some(msg => msg.embeds.length > 0 && msg.components.length > 0);

            if (!hasPanel) {
                const embed = new EmbedBuilder()
                    .setTitle('🤝 Kooperationsanfrage einreichen')
                    .setDescription('Möchtest du Partner der VGPL Germany werden, ein Sponsoring anbieten oder planst du ein gemeinsames Event?\n\nWähle unten die passende Kategorie aus, um das Anfrageformular zu öffnen. Unser Management wird deine Anfrage umgehend prüfen!')
                    .setColor('#00FFAA')
                    .setThumbnail(panelChannel.guild.iconURL())
                    .setFooter({ text: 'VGPL Germany Kooperations-System' });

                // Dropdown-Menü für die Kooperations-Kategorien
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_coop_category')
                    .setPlaceholder('Art der Kooperation auswählen...')
                    .addOptions([
                        { label: '🤝 Partner / Sponsor', value: 'coop_sponsor', description: 'Sponsoring-Angebote oder feste Partnerschaften', emoji: '🤝' },
                        { label: '🎮 Andere Liga / eSports Organisation', value: 'coop_liga', description: 'Zusammenarbeit zwischen Ligen oder Teams', emoji: '🎮' },
                        { label: '📱 Content Creator / Streamer', value: 'coop_creator', description: 'Partnerschaften für Streamer und Creator', emoji: '📱' },
                        { label: '📰 Medienpartner', value: 'coop_medien', description: 'Presse, News oder Content-Sharing', emoji: '📰' },
                        { label: '🏢 Unternehmen', value: 'coop_firma', description: 'B2B Anfragen, Firmenkooperationen', emoji: '🏢' },
                        { label: '🌍 Sonstiges', value: 'coop_sonstiges', description: 'Alle anderen Kooperations-Ideen', emoji: '🌍' }
                    ]);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                await panelChannel.send({ embeds: [embed], components: [row] });
                console.log('Kooperations-Panel erfolgreich gesendet!');
            }
        }
    } catch (err) {
        console.error('Fehler beim Senden des Kooperations-Panels:', err);
    }
});

// Interaktionen verarbeiten (Menüauswahl, Modal Submit, Buttons)
client.on('interactionCreate', async (interaction) => {
    const guild = interaction.guild;
    if (!guild) return;

    const adminRole = guild.roles.cache.find(r => r.name.toLowerCase() === CONFIG.ADMIN_ROLE_NAME.toLowerCase());
    const headAdminRole = guild.roles.cache.find(r => r.name.toLowerCase() === CONFIG.HEAD_ADMIN_ROLE_NAME.toLowerCase());

    // 1. DROPDOWN AUSWAHL -> MODAL (FORMULAR) ÖFFNEN
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_coop_category') {
        const choice = interaction.values[0];
        let categoryName = 'Kooperation';

        switch(choice) {
            case 'coop_sponsor': categoryName = '🤝 Partner / Sponsor'; break;
            case 'coop_liga': categoryName = '🎮 eSports / Liga'; break;
            case 'coop_creator': categoryName = '📱 Creator / Streamer'; break;
            case 'coop_medien': categoryName = '📰 Medienpartner'; break;
            case 'coop_firma': categoryName = '🏢 Unternehmen'; break;
            case 'coop_sonstiges': categoryName = '🌍 Sonstiges'; break;
        }

        const modal = new ModalBuilder().setCustomId(`modal_coop_${choice}`).setTitle(categoryName.substring(0, 45));
       
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('coop_name').setLabel('Dein Name / Discord Name').setStyle(TextInputStyle.Short).setValue(interaction.user.tag).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('coop_org').setLabel('Organisation / Firma / Liga / Team').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('coop_links').setLabel('Webseite oder Social Media Link').setPlaceholder('z.B. Instagram, Twitch, Web-URL (optional)').setStyle(TextInputStyle.Short).setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('coop_description').setLabel('Beschreibung & Zeitraum der Kooperation').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('coop_winwin').setLabel('Was bietet ihr / Was erwartet ihr?').setPlaceholder('Geben & Nehmen (Win-Win Situation beschreiben)').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
       
        return interaction.showModal(modal);
    }

    // 2. FORMULAR ABGESCHICKT -> TICKET ERSTELLEN, KI PRÜFEN, ADMIN-BENACHRICHTIGUNG
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_coop_')) {
        await interaction.deferReply({ ephemeral: true });

        const member = interaction.member;
        const choice = interaction.customId.replace('modal_coop_', '');
       
        // Formulardaten auslesen
        const nameContact = interaction.fields.getTextInputValue('coop_name');
        const orgName = interaction.fields.getTextInputValue('coop_org');
        const links = interaction.fields.getTextInputValue('coop_links') || 'Keine Angabe';
        const description = interaction.fields.getTextInputValue('coop_description');
        const winWin = interaction.fields.getTextInputValue('coop_winwin');

        let categoryTitle = 'Kooperationsanfrage';
        switch(choice) {
            case 'coop_sponsor': categoryTitle = 'Partner / Sponsor'; break;
            case 'coop_liga': categoryTitle = 'Andere Liga / eSports'; break;
            case 'coop_creator': categoryTitle = 'Content Creator / Streamer'; break;
            case 'coop_medien': categoryTitle = 'Medienpartner'; break;
            case 'coop_firma': categoryTitle = 'Unternehmen'; break;
            case 'coop_sonstiges': categoryTitle = 'Sonstiges'; break;
        }

        // --- INTELLIGENTE KI & POTENZIAL-EVALUIERUNG ---
        const textToAnalyze = `${orgName} ${description} ${winWin}`.toLowerCase();
       
        let potentialRating = '⭐⭐'; // Standard-Wert
        let pingLevel = 'NONE'; // NONE = Kein Ping, ADMIN = Admin-Ping, MANAGEMENT = Sofort-Ping
       
        // Analyse-Kriterien
        const budgetKeywords = ['budget', 'geld', 'zahlen', 'euro', 'finanziell', 'sponsoring', 'bezahlen', 'preis', 'kosten', 'investition', '€'];
        const managementKeywords = ['gmbh', 'vertrag', 'große marke', 'hauptpartner', 'exklusivpartner', 'marketing-budget', 'agrar', 'aktiengesellschaft', 'gbr', 'offiziell', 'kooperationsvertrag'];
        const adminKeywords = ['liga', 'turnier', 'streamer', 'creator', 'youtube', 'twitch', 'tiktok', 'social media', 'turnier-kooperation', 'werbung', 'promotion', 'broadcast', 'caster'];

        // Bewertung berechnen
        let score = 0;
        if (budgetKeywords.some(keyword => textToAnalyze.includes(keyword))) score += 3;
        if (managementKeywords.some(keyword => textToAnalyze.includes(keyword))) score += 3;
        if (adminKeywords.some(keyword => textToAnalyze.includes(keyword))) score += 1;
        if (textToAnalyze.length > 250) score += 1; // Ausführliche Beschreibung gibt Bonus

        // Bestimme Rating und Ping-Stufe anhand des Scores
        if (score >= 6) {
            potentialRating = '⭐⭐⭐⭐⭐ Hoch';
            pingLevel = 'MANAGEMENT';
        } else if (score >= 3) {
            potentialRating = '⭐⭐⭐⭐ Mittel-Hoch';
            pingLevel = 'ADMIN';
        } else if (score >= 1) {
            potentialRating = '⭐⭐⭐ Mittel';
            pingLevel = 'ADMIN';
        } else {
            potentialRating = '⭐⭐ Niedrig / Unverbindlich';
            pingLevel = 'NONE';
        }

        const fields = [
            { name: 'Ansprechpartner / Name', value: nameContact, inline: true },
            { name: 'Organisation / Firma', value: orgName, inline: true },
            { name: 'Kategorie', value: categoryTitle, inline: true },
            { name: 'Webseite / Social Links', value: links },
            { name: 'Beschreibung der Anfrage', value: description },
            { name: 'Erwartung & Gegenleistung (Win-Win)', value: winWin }
        ];

        // Systemantwort mit den Liga-Informationen
        const botResponse = `Vielen Dank für deine Kooperationsanfrage an VGPL Germany.\nWir haben deine Anfrage erhalten.\n\n### Zusammenfassung:\n• Organisation: **✅ Erhalten**\n• Kooperationsart: **✅ ${categoryTitle}**\n• Beschreibung: **✅ Erhalten**\n\nDeine Anfrage wird von unserem Management-Team geprüft.\n\n**Bitte sende bei Bedarf weitere Informationen wie:**\n• Präsentationen / Media-Kits\n• Statistiken (z.B. Reichweite)\n• Social-Media-Daten oder Links\n• Konkrete Angebote oder Konzepte\n\nEin Ansprechpartner der VGPL Germany wird sich nach der internen Prüfung direkt hier in diesem Ticket bei dir melden!`;

        try {
            // Berechtigungen festlegen
            const permissionOverwrites = [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels] }
            ];

            if (adminRole) {
                permissionOverwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels] });
            }
            if (headAdminRole) {
                permissionOverwrites.push({ id: headAdminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels] });
            }

            // Ticket-Kanal erstellen
            const ticketChannel = await guild.channels.create({
                name: `coop-${orgName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                type: ChannelType.GuildText,
                parent: CONFIG.CATEGORY_ID,
                permissionOverwrites: permissionOverwrites,
                topic: `Kooperations-Ticket für ${orgName}`
            });

            const infoEmbed = new EmbedBuilder()
                .setTitle(`🤝 Kooperationsanfrage: ${categoryTitle}`)
                .setDescription(`Dieses Ticket wurde von ${member} erstellt.`)
                .addFields(fields)
                .setColor('#00FFAA')
                .setTimestamp();

            const aiEmbed = new EmbedBuilder()
                .setTitle('🤖 VGPL Germany Cooperation Bot')
                .setDescription(botResponse)
                .setColor('#2F3136')
                .setTimestamp();

            const closeButton = new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Ticket schließen')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(closeButton);

            await ticketChannel.send({
                content: `${member}`,
                embeds: [infoEmbed, aiEmbed],
                components: [row]
            });

            // 3. ADMIN-BENACHRICHTIGUNG IM ADMIN-CHAT (1527715001681576166)
            const adminChannel = await guild.channels.fetch(CONFIG.ADMIN_CHAT_CHANNEL_ID).catch(() => null);
            if (adminChannel) {
                const adminEmbed = new EmbedBuilder()
                    .setTitle('🤝 Neue Kooperationsanfrage')
                    .setDescription(`Der User ${member} hat eine Kooperationsanfrage eingereicht.`)
                    .addFields([
                        { name: 'Organisation / Firma', value: orgName, inline: true },
                        { name: 'Kategorie', value: categoryTitle, inline: true },
                        { name: 'Ansprechpartner', value: nameContact, inline: true },
                        { name: 'Beschreibung', value: description.length > 500 ? description.substring(0, 500) + '...' : description },
                        { name: 'Potenzial', value: potentialRating, inline: true }
                    ])
                    .setColor(pingLevel === 'MANAGEMENT' ? '#FF0000' : (pingLevel === 'ADMIN' ? '#FFFF00' : '#00FFAA'))
                    .setTimestamp();

                const btnAkzeptieren = new ButtonBuilder()
                    .setCustomId('coop_akzeptieren')
                    .setLabel('Akzeptieren')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅');

                const btnBearbeitung = new ButtonBuilder()
                    .setCustomId('coop_bearbeitung')
                    .setLabel('In Verhandlung')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⏳');

                const btnAblehnen = new ButtonBuilder()
                    .setCustomId('coop_ablehnen')
                    .setLabel('Ablehnen')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌');

                const adminRow = new ActionRowBuilder().addComponents(btnAkzeptieren, btnBearbeitung, btnAblehnen);

                // Ping-Logik anwenden
                let pingContent = '';
                const mentions = [];

                if (pingLevel === 'MANAGEMENT') {
                    pingContent = `🚨 **DRINGENDES SPONSORING- / PARTNERSCHAFTSANGEBOT!** @everyone`;
                } else if (pingLevel === 'ADMIN') {
                    let adminAlert = `🔔 **Neue Kooperationsanfrage zur Freigabe!** `;
                    if (adminRole) { adminAlert += `${adminRole} `; mentions.push(adminRole.id); }
                    if (headAdminRole) { adminAlert += `${headAdminRole} `; mentions.push(headAdminRole.id); }
                    pingContent = adminAlert;
                } else {
                    pingContent = `📝 **Neue Kooperationsanfrage eingegangen (Kein Ping-Bedarf)**`;
                }

                const adminMsg = await adminChannel.send({
                    content: pingContent,
                    embeds: [adminEmbed],
                    components: [adminRow],
                    allowedMentions: { parse: ['everyone'], roles: mentions }
                });

                // Verbindung im Cache speichern
                activeCooperations.set(adminMsg.id, {
                    ticketChannelId: ticketChannel.id,
                    memberId: member.id,
                    partnerName: orgName
                });
            }

            await interaction.editReply({
                content: `Deine Anfrage wurde erfolgreich eingereicht. Dein privates Ticket wurde erstellt: ${ticketChannel}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Fehler beim Erstellen des Kooperations-Kanals:', error);
            await interaction.editReply({
                content: 'Fehler beim Erstellen deines Tickets. Bitte wende dich an die Administration.',
                ephemeral: true
            });
        }
    }

    // 3. ENTSCHEIDUNG DER ADMINS (Buttons im Admin-Chat)
    if (interaction.isButton() && ['coop_akzeptieren', 'coop_bearbeitung', 'coop_ablehnen'].includes(interaction.customId)) {
        await interaction.deferUpdate();

        const cacheData = activeCooperations.get(interaction.message.id);
        if (!cacheData) {
            return interaction.followUp({ content: 'Fehler: Zu dieser Kooperation konnten keine Ticket-Daten gefunden werden.', ephemeral: true });
        }

        const { ticketChannelId, memberId, partnerName } = cacheData;
        const ticketChannel = guild.channels.cache.get(ticketChannelId);
        const applicant = await guild.members.fetch(memberId).catch(() => null);

        let statusText = '';
        let embedColor = '#000000';
        let actionMessage = '';

        if (interaction.customId === 'coop_akzeptieren') {
            statusText = `✅ **AKZEPTIERT** von ${interaction.user.username}`;
            embedColor = '#00FF00';
            actionMessage = `🎉 **Gute Nachrichten!** Das VGPL Germany Management hat deine Kooperationsanfrage für **${partnerName}** **angenommen**. Ein Administrator wird sich in Kürze hier im Ticket mit dir abstimmen!`;
        } else if (interaction.customId === 'coop_bearbeitung') {
            statusText = `⏳ **IN VERHANDLUNG** von ${interaction.user.username}`;
            embedColor = '#FFA500';
            actionMessage = `⏳ Deine Kooperationsanfrage für **${partnerName}** befindet sich nun **in Verhandlung**. Das Management prüft deine Angaben und wird sich gleich hier melden.`;
        } else if (interaction.customId === 'coop_ablehnen') {
            statusText = `❌ **ABGELEHNT** von ${interaction.user.username}`;
            embedColor = '#FF0000';
            actionMessage = `❌ Deine Kooperationsanfrage für **${partnerName}** wurde vom Management leider **abgelehnt**. Wir bedanken uns herzlich für dein Angebot und Interesse an der VGPL Germany.`;
        }

        // Admin-Embed im Admin-Kanal aktualisieren
        const oldEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(oldEmbed)
            .setColor(embedColor)
            .setTitle(`🤝 Kooperationsanfrage: ${statusText}`);

        await interaction.message.edit({
            content: `Kooperation aktualisiert: ${statusText}`,
            embeds: [updatedEmbed],
            components: [] // Buttons sperren
        });

        // Rückmeldung im Ticket des Nutzers senden
        if (ticketChannel) {
            const decisionEmbed = new EmbedBuilder()
                .setTitle('📢 Statusänderung deiner Anfrage')
                .setDescription(actionMessage)
                .setColor(embedColor)
                .setTimestamp();

            await ticketChannel.send({ content: `${applicant || ''}`, embeds: [decisionEmbed] });
        }
    }

    // 4. BEWERBUNGSTICKET SCHLIESSEN BUTTON
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: '🔒 Dieses Ticket wird in 5 Sekunden gelöscht...' });
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
                activeCooperations.delete(interaction.channel.id);
            } catch (err) {
                console.error(err);
            }
        }, 5000);
    }
});

// Login
client.login(CONFIG.TOKEN);

