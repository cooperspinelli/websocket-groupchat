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

  /** Handle joke command from client:
   *
   */

  handleJoke(modifiers) {
    this._send(JSON.stringify({
      name: "server",
      type: "chat",
      text: "This is a funny joke",
    }));
  }

  /** Handle member command from client:
   *
   */

  handleMembers(modifiers) {
    let usersList = [...this.room.members];
    usersList = usersList.map(u => u.name);
    console.log("usersList", usersList);
    this._send(JSON.stringify({
      name: "server",
      type: "chat",
      text: `In room: ${usersList.join(", ")}`,
    }));
  }

  handlePrivMessage(modifiers) {

  }


  handleChangeName(modifiers) {
    if (modifiers.length === 0) {
      this._send(JSON.stringify({
        name: "server",
        type: "chat",
        text: `You must specify your new name`
      }));
    } else {
      const oldName = this.name;
      this.name = modifiers[0];
      this.room.broadcast({
        name: "server",
        type: "chat",
        text: `${oldName} changed their name to ${this.name}`
      });
    }
  }

  /** Handle command from client:
   *
   */

  handleCommand(text) {
    const commands = {
      "/joke": modifiers => this.handleJoke(modifiers),
      "/members": modifiers => this.handleMembers(modifiers),
      "/priv": modifiers => this.handlePrivMessage(modifiers),
      "/name": modifiers => this.handleChangeName(modifiers)
    }

    const commandPlusModifiers = text.split(' ');
    const command = commandPlusModifiers[0];
    const modifiers = commandPlusModifiers.slice(1)

    commands[command](modifiers);
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
