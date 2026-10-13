import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/crypto";
import { UserCreateSchema } from "@/lib/validations/users";

export async function GET(req: NextRequest) {
  try {
    const authCheck = await checkSessionPermission("USER_ADMIN");
    if (!authCheck.authorized) return authCheck.response!;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const rolId = searchParams.get("rolId") || undefined;
    const estado = searchParams.get("estado") || undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: "insensitive" } },
        { correo: { contains: search, mode: "insensitive" } },
      ];
    }
    if (rolId) where.rolId = rolId;
    if (estado) where.estado = estado;

    const [total, usuarios] = await Promise.all([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          nombre: true,
          correo: true,
          rolId: true,
          rol: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
            },
          },
          empleadoId: true,
          estado: true,
          ultimoLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      data: usuarios,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error en GET /api/usuarios:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar los usuarios.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await checkSessionPermission("USER_ADMIN");
    if (!authCheck.authorized) return authCheck.response!;

    const body = await req.json().catch(() => null);
    const parsed = UserCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos proporcionados no satisfacen el esquema de validación.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const { nombre, correo, password, rolId, empleadoId, estado } = parsed.data;

    // 1. Validar unicidad de correo institucional
    const existing = await prisma.usuario.findUnique({
      where: { correo },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "USER_DUPLICATE_EMAIL",
          message: "Ya existe un usuario institucional registrado con este correo.",
        },
        { status: 409 }
      );
    }

    // 2. Validar existencia del rol
    const rol = await prisma.rol.findUnique({
      where: { id: rolId },
    });
    if (!rol) {
      return NextResponse.json(
        {
          error: "ROLE_NOT_FOUND",
          message: "El rol asignado no existe en el catálogo de seguridad.",
        },
        { status: 404 }
      );
    }

    // 3. Hashear contraseña con bcrypt
    const passwordHash = await hashPassword(password);

    // 4. Crear usuario
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        correo,
        passwordHash,
        rolId,
        empleadoId: empleadoId || null,
        estado: estado || "ACTIVO",
      },
      select: {
        id: true,
        nombre: true,
        correo: true,
        rolId: true,
        rol: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
          },
        },
        empleadoId: true,
        estado: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(nuevoUsuario, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/usuarios:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al registrar el usuario.",
      },
      { status: 500 }
    );
  }
}