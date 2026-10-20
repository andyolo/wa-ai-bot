const { Message } = require('whatsapp-web.js');

function normalizeQuotedMessage(message, quotedData) {
    const quotedId = quotedData?.id;
    if (!quotedData || !quotedId) {
        return undefined;
    }

    const serializedId =
        typeof quotedId === 'string'
            ? /^(true|false)_.+@[^_]+_.+/.test(quotedId)
                ? quotedId
                : undefined
            : typeof quotedId._serialized === 'string'
                ? quotedId._serialized
                : undefined;
    const parsedSerializedId = serializedId?.match(
        /^(true|false)_(.+?@[^_]+)_(.+)$/
    );
    const idData =
        typeof quotedId === 'object' ? quotedId : {};
    const remoteValue =
        idData.remote ||
        quotedData.from ||
        quotedData.to ||
        parsedSerializedId?.[2];
    const remote =
        typeof remoteValue === 'object'
            ? remoteValue?._serialized
            : remoteValue;
    const messageId =
        typeof quotedId === 'string' && !serializedId
            ? quotedId
            : idData.id || parsedSerializedId?.[3];
    const participantValue =
        idData.participant || quotedData.author;
    const participant =
        typeof participantValue === 'object'
            ? participantValue?._serialized
            : participantValue;

    if (!remote || !messageId) {
        return undefined;
    }

    const fromMe =
        idData.fromMe === true ||
        idData.fromMe === 'true' ||
        parsedSerializedId?.[1] === 'true';
    const normalizedId = {
        ...idData,
        fromMe,
        remote,
        id: messageId,
        ...(participant ? { participant } : {}),
        _serialized: serializedId ||
            `${fromMe ? 'true' : 'false'}_${remote}_${messageId}` +
                (participant ? `_${participant}` : '')
    };

    return new Message(message.client, {
        ...quotedData,
        id: normalizedId
    });
}

function serializeMessageId(id) {
    if (id?._serialized) {
        return id._serialized;
    }

    const remote =
        typeof id?.remote === 'object'
            ? id.remote?._serialized
            : id?.remote;

    if (!remote || !id?.id) {
        return undefined;
    }

    const fromMe = id.fromMe === true || id.fromMe === 'true';
    const participant =
        typeof id.participant === 'object'
            ? id.participant?._serialized
            : id.participant;

    return `${fromMe ? 'true' : 'false'}_${remote}_${id.id}` +
        (participant ? `_${participant}` : '');
}

function getQuotedMessage(message) {
    const quotedMessage = normalizeQuotedMessage(
        message,
        message?._data?.quotedMsg
    );

    return quotedMessage || getQuotedMessageFallback(message);
}

async function getQuotedMessageFallback(message) {
    const parentMessageId = serializeMessageId(message?.id);

    if (!message?.hasQuotedMsg || !parentMessageId) {
        return undefined;
    }

    const quotedData = await message.client.pupPage.evaluate(async (msgId) => {
        const collections = window.require('WAWebCollections');
        const parentMessage =
            collections.Msg.get(msgId) ||
            (
                await collections.Msg.getMessagesById([msgId])
            )?.messages?.[0];

        if (!parentMessage) {
            throw new Error(
                'Pesan command tidak ditemukan di koleksi WhatsApp Web.'
            );
        }

        const quotedMessage = window
            .require('WAWebQuotedMsgModelUtils')
            .getQuotedMsgObj(parentMessage);

        if (!quotedMessage) {
            return null;
        }

        return quotedMessage.serialize();
    }, parentMessageId);

    if (!quotedData?.id) {
        throw new Error(
            'WhatsApp mendeteksi reply, tetapi model pesan target tidak tersedia.'
        );
    }

    const quotedMessage = normalizeQuotedMessage(message, quotedData);
    if (!quotedMessage) {
        throw new Error(
            'Model reply WhatsApp tidak memiliki remote chat atau ID pesan.'
        );
    }

    return quotedMessage;
}

async function deleteQuotedMessageForEveryone(message) {
    const messageId = message?.id?._serialized;

    if (!messageId) {
        throw new Error('ID pesan yang akan dihapus tidak valid.');
    }

    return message.client.pupPage.evaluate(async (msgId) => {
        const collections = window.require('WAWebCollections');
        const msg =
            collections.Msg.get(msgId) ||
            (
                await collections.Msg.getMessagesById([msgId])
            )?.messages?.[0];

        if (!msg) {
            throw new Error('Pesan yang akan dihapus tidak ditemukan.');
        }

        const chat =
            collections.Chat.get(msg.id.remote) ||
            (await collections.Chat.find(msg.id.remote));

        if (!chat) {
            throw new Error('Grup pesan yang akan dihapus tidak ditemukan.');
        }

        const capability = window.require('WAWebMsgActionCapability');
        const canRevoke =
            capability.canSenderRevokeMsg(msg) ||
            capability.canAdminRevokeMsg(msg);

        if (!canRevoke) {
            throw new Error(
                'Bot tidak memiliki izin untuk menghapus pesan ini untuk semua orang.'
            );
        }

        const { Cmd } = window.require('WAWebCmd');

        return window.WWebJS.compareWwebVersions(
            window.Debug.VERSION,
            '>=',
            '2.3000.0'
        )
            ? Cmd.sendRevokeMsgs(
                  chat,
                  { list: [msg], type: 'message' },
                  { clearMedia: true }
              )
            : Cmd.sendRevokeMsgs(chat, [msg], {
                  clearMedia: true,
                  type: msg.id.fromMe ? 'Sender' : 'Admin'
              });
    }, messageId);
}

module.exports = {
    getQuotedMessage,
    deleteQuotedMessageForEveryone
};
