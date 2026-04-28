pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("46Brqof8bysRqDbaYH1NTdYWfYP53zb1JfXPPX5nC1xL");

#[program]
pub mod solana_programs {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn rent_book(ctx: Context<RentBook>, book_id: String, amount: u64) -> Result<()> {
        instructions::rent_book::rent_book(ctx, book_id, amount)
    }

    pub fn return_book(ctx: Context<ReturnBook>, book_id: String) -> Result<()> {
        instructions::return_book::return_book(ctx, book_id)
    }
}
