import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/crypto";
import { UserUpdateSchema } from "@/lib/validations/users";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authCheck = await checkSessionPermission();
    if (!authCheck.authorized) return authCheck.response!;

    const session = authCheck.session!;
    const isOwner = session.user.id === id;
    const isAdmin =
      session.user.rol?.codigo === "ADMIN" ||
      (session.user.permisos || []).includes("USER_ADMIN");

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "No posee permisos para consultar la información de este usuario.",
        },
        { status: 403 }
      );
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id },
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
            permisos: {
              select: {
                permiso: {
                  select: {
                    id: true,
                    codigo: true,
                    modulo: true,
                    descripcion: true,
                  },
                },
              },
            },
          },
        },
        empleadoId: true,
        estado: true,
        ultimoLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND", message: "Usuario no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(usuario);
  } catch (error) {
    console.error("Error en GET /api/usuarios/[id]:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar el usuario.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authCheck = await checkSessionPermission("USER_ADMIN");
    if (!authCheck.authorized) return authCheck.response!;

    const session = authCheck.session!;
    const body = await req.json().catch(() => null);
    const parsed = UserUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos de actualización no satisfacen el esquema de validación.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const dataToUpdate = parsed.data;

    // Regla de Negocio: No puede desactivar o degradar su propia cuenta de administrador
    if (session.user.id === id) {
      if (dataToUpdate.estado === "INACTIVO") {
        return NextResponse.json(
          {
            error: "CANNOT_DEACTIVATE_SELF_ADMIN",
            message: "No puede desactivar su propia cuenta de administrador en sesión.",
          },
          { status: 400 }
        );
      }
      if (dataToUpdate.rolId && dataToUpdate.rolId !== session.user.rol?.id) {
        return NextResponse.json(
          {
            error: "CANNOT_DEACTIVATE_SELF_ADMIN",
            message: "No puede degradar su propio rol de administrador en sesión.",
          },
          { status: 400 }
        );
      }
    }

    const targetUser = await prisma.usuario.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND", message: "Usuario a actualizar no encontrado." },
        { status: 404 }
      );
    }

    // Si se actualiza el correo, validar que no esté ocupado
    if (dataToUpdate.correo && dataToUpdate.correo !== targetUser.correo) {
      const emailOccupied = await prisma.usuario.findUnique({
        where: { correo: dataToUpdate.correo },
      });
      if (emailOccupied) {
        return NextResponse.json(
          {
            error: "USER_DUPLICATE_EMAIL",
            message: "El nuevo correo institucional ya se encuentra en uso por otra cuenta.",
          },
          { status: 409 }
        );
      }
    }

    // Si se actualiza el rol, validar que exista
    if (dataToUpdate.rolId) {
      const roleExists = await prisma.rol.findUnique({
        where: { id: dataToUpdate.rolId },
      });
      if (!roleExists) {
        return NextResponse.json(
          { error: "ROLE_NOT_FOUND", message: "El rol seleccionado no existe." },
          { status: 404 }
        );
      }
    }

    // Preparar objeto de mutación
    const prismaUpdateData: any = {};
    if (dataToUpdate.nombre !== undefined) prismaUpdateData.nombre = dataToUpdate.nombre;
    if (dataToUpdate.correo !== undefined) prismaUpdateData.correo = dataToUpdate.correo;
    if (dataToUpdate.rolId !== undefined) prismaUpdateData.rolId = dataToUpdate.rolId;
    if (dataToUpdate.empleadoId !== undefined) prismaUpdateData.empleadoId = dataToUpdate.empleadoId;
    if (dataToUpdate.estado !== undefined) prismaUpdateData.estado = dataToUpdate.estado;
    if (dataToUpdate.password) {
      prismaUpdateData.passwordHash = await hashPassword(dataToUpdate.password);
    }

    const updatedUser = await prisma.usuario.update({
      where: { id },
      data: prismaUpdateData,
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

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error en PUT /api/usuarios/[id]:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al actualizar el usuario.",
      },
      { status: 500 }
    );
  }
}