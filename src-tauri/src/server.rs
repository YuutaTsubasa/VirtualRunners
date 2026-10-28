//! 比賽伺服器（房主的 App 內建，或 `npm run server` 單獨跑）。
//! 伺服器本身在 VirtualCore 的 virtual-lan（Virtual 系列共用）：
//! - `/ws`      玩家與觀眾的 WebSocket
//! - 其他路徑   前端靜態檔（讓沒裝 App 的人用瀏覽器加入）
//!
//! 比賽在伺服器上跑（每秒 60 個影格），玩家只送輸入，伺服器把每個影格的狀態廣播出去。

use runner_core::room::{Room, Settings};

pub use virtual_lan::{local_ips, AssetFn};

pub type ServerHandle = virtual_lan::ServerHandle<Room>;

pub async fn start(port: u16, settings: Settings, assets: Option<AssetFn>) -> Result<ServerHandle, String> {
    let mut room = Room::default();
    room.update_settings(settings);
    virtual_lan::start(port, room, assets, "虛擬跑跑樂伺服器").await
}
