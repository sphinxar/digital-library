use anchor_lang::prelude::*;

#[account]
pub struct RentalRecord {
    pub user: Pubkey,
    pub book_id: String,
    pub timestamp: i64,
    pub amount: u64,
}

impl RentalRecord {
    // 8 discriminator + 32 user + (4 + string len) + 8 timestamp + 8 amount
    // Let's assume max book_id length of 36 (UUID)
    pub const MAX_SIZE: usize = 8 + 32 + (4 + 36) + 8 + 8;
}
