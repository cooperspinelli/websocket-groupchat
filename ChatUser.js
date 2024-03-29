"use strict";

/** Functionality related to chatting. */

// Room is an abstraction of a chat channel
const Room = require("./Room");

/** ChatUser is a individual connection from client -> server to chat. */

class ChatUser {
  /** Make chat user: store connection-device, room.
   *
   * @param send {function} callback to send message to this user
   * @param room {Room} room user will be in
   * */

  constructor(send, roomName) {
    this._send = send; // "send" function for this user
    this.room = Room.get(roomName); // room user will be in
    this.name = null; // becomes the username of the visitor

    console.log(`created chat in ${this.room.name}`);
  }

  /** Send msgs to this client using underlying connection-send-function.
   *
   * @param data {string} message to send
   * */

  send(data) {
    try {
      this._send(data);
    } catch {
      // If trying to send to a user fails, ignore it
    }
  }

  /** Handle joining: add to room members, announce join.
   *
   * @param name {string} name to use in room
   * */

  handleJoin(name) {
    this.name = name;
    this.room.join(this);
    this.room.broadcast({
      type: "note",
      text: `${this.name} joined "${this.room.name}".`,
    });
  }

  /** Handle a chat: broadcast to room.
   *
   * @param text {string} message to send
   * */

  handleChat(text) {
    this.room.broadcast({
      name: this.name,
      type: "chat",
      text: text,
    });
  }

  /** Handles joke command */
  handleJoke(text) {
    this._send(JSON.stringify({
      name: "server",
      type: "chat",
      text: "This is a funny joke",
    }));
  }

  /** Handles members command */
  handleMembers(text) {
    const usersList = [...this.room.members].map(u => u.name);
    this._send(JSON.stringify({
      name: "server",
      type: "chat",
      text: `In room: ${usersList.join(", ")}`,
    }));
  }

  /** Handles private message command */
  handlePrivMessage(text) {
    const splitText = text.split(" ");

    if (splitText.length < 3) {
      this._send(JSON.stringify(
        {
          name: "server",
          type: "chat",
          text: "You must specify a user and a message",
        }
      ));
      return;
    }

    const toUsername = splitText[1];

    if (toUsername === this.name) {
      this._send(JSON.stringify(
        {
          name: "server",
          type: "chat",
          text: "You cannot send a message to yourself",
        }
      ));
      return;
    }

    const message = splitText.slice(2).join(" ");
    const toUserInstance = [...this.room.members].find(
      u => u.name === toUsername);

    const messageData = {
      name: `Private Message from ${this.name} to ${toUsername}`,
      type: "chat",
      text: message,
    };

    toUserInstance._send(JSON.stringify(messageData));
    this._send(JSON.stringify(messageData));
  }

  /** Handles name change command */
  handleChangeName(text) {
    const newName = text.split(" ")[1];

    if (!newName) {
      this._send(JSON.stringify({
        name: "server",
        type: "chat",
        text: `You must specify your new name`
      }));
    } else {
      this.room.broadcast({
        name: "server",
        type: "chat",
        text: `${this.name} changed their name to ${newName}`
      });

      this.name = newName;
    }
  }

  /** Handles unknown command */
  handleUnkownCommand(text) {
    const command = text.split(' ')[0];
    this._send(JSON.stringify({
      name: "server",
      type: "chat",
      text: `${command} is an unknown command.`
    }));
  }

  /** Handles message that starts with / */
  handleCommand(text) {
    const commands = {
      "/joke": () => this.handleJoke(text),
      "/members": () => this.handleMembers(text),
      "/priv": () => this.handlePrivMessage(text),
      "/name": () => this.handleChangeName(text),
      "unknown": () => this.handleUnkownCommand(text)
    };

    const command = text.split(' ')[0];
    const commandMethod = (commands[command] || commands["unknown"]);
    commandMethod();
  }

  /** Handle messages from client:
   *
   * @param jsonData {string} raw message data
   *
   * @example<code>
   * - {type: "join", name: username} : join
   * - {type: "chat", text: msg }     : chat
   * </code>
   */

  handleMessage(jsonData) {
    let msg = JSON.parse(jsonData);

    if (msg.type === "join") this.handleJoin(msg.name);
    else if (msg.type === "chat") this.handleChat(msg.text);
    else if (msg.type === "command") this.handleCommand(msg.text);
    else throw new Error(`bad message: ${msg.type}`);
  }

  /** Connection was closed: leave room, announce exit to others. */

  handleClose() {
    this.room.leave(this);
    this.room.broadcast({
      type: "note",
      text: `${this.name} left ${this.room.name}.`,
    });
  }
}

module.exports = ChatUser;
