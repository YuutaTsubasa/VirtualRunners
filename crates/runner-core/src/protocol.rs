//! 連線訊息（JSON）的處理：hello、progress（自己跑到哪）、host 指令…，回覆 welcome、error、room、frame。
//! 區網伺服器（VirtualCore 的 virtual-lan，WebSocket）與線上房間的房主瀏覽器（crates/runner-wasm，WebRTC）
//! 共用這一份，所以兩種房間的行為一模一樣。程式在 VirtualCore 的 virtual-room（五款共用），
//! 跑跑樂自己的部分（進度回報、開跑、下一關、斷線算棄權）在 room.rs 的 `RoomGame` 實作。

pub use virtual_room::protocol::{drop_conn, err, frame_message, handle, room_message, Conn};
