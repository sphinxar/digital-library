import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userPubkey, txSignature } = body;

    if (!userPubkey || !txSignature) {
      return NextResponse.json(
        { error: 'Missing userPubkey or txSignature' },
        { status: 400 }
      );
    }

    // Optional in production: Verify the txSignature actually transferred SOL
    // to the treasury and called the correct program instruction.

    const book = await prisma.book.findUnique({ where: { id } });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    if (book.status === 'RENTED') {
      return NextResponse.json({ error: 'Book is already rented' }, { status: 400 });
    }

    // Use a transaction to ensure both DB operations succeed or fail together
    const result = await prisma.$transaction([
      prisma.book.update({
        where: { id },
        data: { status: 'RENTED' },
      }),
      prisma.rental.create({
        data: {
          bookId: id,
          userPubkey,
          txSignature,
        },
      }),
    ]);

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error renting book:', error);
    return NextResponse.json({ error: 'Failed to rent book' }, { status: 500 });
  }
}
