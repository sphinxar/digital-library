import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaPrograms } from "../target/types/solana_programs";
import { expect } from "chai";

describe("solana-programs", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaPrograms as Program<SolanaPrograms>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });

  it("Rents a book", async () => {
    const bookId = "book-123";
    const amount = new anchor.BN(1000000); // 0.001 SOL
    const user = provider.wallet;

    const [rentalRecordPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("rental"), Buffer.from(bookId)],
      program.programId
    );

    // Using a random keypair as treasury for the test
    const treasury = anchor.web3.Keypair.generate();

    const tx = await program.methods
      .rentBook(bookId, amount)
      .accounts({
        rentalRecord: rentalRecordPda,
        user: user.publicKey,
        treasury: treasury.publicKey,
      })
      .rpc();

    console.log("Rent transaction signature", tx);

    const record = await program.account.rentalRecord.fetch(rentalRecordPda);
    expect(record.user.toBase58()).to.equal(user.publicKey.toBase58());
    expect(record.bookId).to.equal(bookId);
    expect(record.amount.toNumber()).to.equal(amount.toNumber());

    const treasuryBalance = await provider.connection.getBalance(treasury.publicKey);
    expect(treasuryBalance).to.equal(amount.toNumber());
  });

  it("Returns a book", async () => {
    const bookId = "book-123";
    const user = provider.wallet;

    const [rentalRecordPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("rental"), Buffer.from(bookId)],
      program.programId
    );

    const tx = await program.methods
      .returnBook(bookId)
      .accounts({
        rentalRecord: rentalRecordPda,
        user: user.publicKey,
      })
      .rpc();

    console.log("Return transaction signature", tx);

    try {
      await program.account.rentalRecord.fetch(rentalRecordPda);
      expect.fail("The account should be closed");
    } catch (e) {
      expect((e as Error).message).to.include("Account does not exist");
    }
  });
});
