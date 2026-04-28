use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;

#[derive(Accounts)]
#[instruction(book_id: String)]
pub struct ReturnBook<'info> {
    #[account(
        mut,
        close = user,
        seeds = [b"rental", book_id.as_bytes()],
        bump,
        has_one = user @ LibraryError::UnauthorizedReturn
    )]
    pub rental_record: Account<'info, RentalRecord>,

    #[account(mut)]
    pub user: Signer<'info>,
}

pub fn return_book(_ctx: Context<ReturnBook>, _book_id: String) -> Result<()> {
    // The rental record is closed and rent is refunded to the user automatically
    Ok(())
}
