const { Client, Intents } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    getVoiceConnection,
    createAudioResource,
    AudioPlayerStatus, } = require("@discordjs/voice");
const { VoiceText }= require('voice-text')
const { Readable } = require('stream')
const fs = require('fs');

// const replaceText = require('../utils')
// const slashCommand = require('../commands/slashCommand')
const {tokens, config} = initConfig()
const voiceText = new VoiceText(tokens.voiceText)

let queue = []
let audioPlayer

module.exports = {
    run() {
        const DiscordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
        DiscordClient.login(tokens.discord)
        DiscordClient.on('ready', () => {
            console.log('Bot Logging in')
            // slashCommand('550612302089682958')
            this.messageListener(DiscordClient)
        })
    },
    messageListener(client) {
        client.on("messageCreate", async (msg) => {
            if (msg.author.bot) return false;
            const command = msg.content.split(' ')
            // const channel = msg.channel
            // const user = msg.author
            switch (command[0]) {
                case '/join':
                    const nowConnectionChannel = msg.member.voice.channel
                    audioPlayer = connectChannel(nowConnectionChannel)
                    break
                case '/bye':
                    const connection = getVoiceConnection(msg.guild.id)
                    connection ? connection.destroy() : false
                    break
                case '.':
                    break
                default:
                    if(msg.channel.id === config.runningChannel ) {
                        queue.push(msg)
                        readMessage(queue.shift())
                    }
                    break
            }
        })
    }
}

function initConfig() {
    const tokenJson = JSON.parse(fs.readFileSync('./config/token.json', 'utf8'));
    const vtToken = tokenJson.voiceText.token
    const dcToken = tokenJson.discord.token
    const tokens = {"voiceText": vtToken, "discord": dcToken}

    const configJson = JSON.parse(fs.readFileSync('./config/config.json', 'utf8'));
    const channel = configJson.runningChannel
    const botId = configJson.botId
    const config = {"runningChannel": channel, "botId": botId}

    // configのすべての値が設定されていることを確認する
    if (Object.values(tokens).concat(Object.values(config)).every(elm => {return elm})) {
        return {"tokens": tokens, "config": config}
    } else {
        throw "Invalid config value!"
    }
}

function connectChannel(channel) {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
    });

    const audioPlayer = createAudioPlayer();
    const subscription = connection.subscribe(audioPlayer)

    return audioPlayer
}

function readMessage(body) {
    // 201文字以上はvoiceTextが受け付けないので 201文字以上を削除する
    const message = (body.content.length <= 200) ? body.content.match(/.{1,200}/g)[0] : body.content
    if (!message) return false
    const connection = getVoiceConnection(body.guild.id)
    if (connection) {
        body.react('🗣️')
        // voiceText.fetchBuffer(replaceText(message))
        voiceText.fetchBuffer(message, {format: 'wav'})
            .then(buffer => {
                const resource = createAudioResource(bufferToStream(buffer))
                audioPlayer.play(resource)
                audioPlayer.on(AudioPlayerStatus.Idle, () => {
                    body.reactions.resolve('🗣️').users.remove(config.botId)
                    if (queue.length > 0) {
                        readMessage(queue.shift())
                    }
                });
            })
    } else {
    }
}

const bufferToStream = (buffer) => {
    const stream = new Readable()
    stream.push(buffer)
    stream.push(null)
    return stream
}

