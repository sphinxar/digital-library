use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;

#[derive(Accounts)]
#[instruction(book_id: String)]
pub struct RentBook<'info> {
    #[account(
        init,
        payer = user,
        space = RentalRecord::MAX_SIZE,
        seeds = [b"rental", book_id.as_bytes()],
        bump
    )]
    pub rental_record: Account<'info, RentalRecord>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: The treasury is a fixed public key or simply any account where the SOL goes.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn rent_book(ctx: Context<RentBook>, book_id: String, amount: u64) -> Result<()> {
    let rental_record = &mut ctx.accounts.rental_record;

    rental_record.user = ctx.accounts.user.key();
    rental_record.book_id = book_id;
    rental_record.timestamp = Clock::get()?.unix_timestamp;
    rental_record.amount = amount;

    // Transfer SOL from user to treasury
    if amount > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            amount,
        )?;
    }

    Ok(())
}
