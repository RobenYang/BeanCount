"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Archive,
  PackageMinus,
  BarChart3,
  Settings, // Example for future use
  Users, // Example for future use
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar"

const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/products/add", label: "Add Product", icon: PlusCircle },
  { href: "/stock/intake", label: "Stock Intake", icon: Archive },
  { href: "/stock/outflow", label: "Stock Outflow", icon: PackageMinus },
  { href: "/stock/valuation", label: "Valuation", icon: BarChart3 },
]

export function MainNav() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar();

  const handleLinkClick = () => {
    setOpenMobile(false); // Close mobile sidebar on link click
  };

  return (
    <SidebarMenu>
      <SidebarGroup>
        <SidebarGroupLabel>Menu</SidebarGroupLabel>
        {menuItems.map(({ href, label, icon: Icon }) => (
          <SidebarMenuItem key={href}>
            <Link href={href} passHref legacyBehavior>
              <SidebarMenuButton
                asChild
                isActive={pathname === href}
                onClick={handleLinkClick}
                tooltip={label}
              >
                <a>
                  <Icon />
                  <span>{label}</span>
                </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        ))}
      </SidebarGroup>

      {/* Example of another group for future expansion */}
      {/* <SidebarGroup>
        <SidebarGroupLabel>Settings</SidebarGroupLabel>
        <SidebarMenuItem>
          <Link href="/settings" passHref legacyBehavior>
            <SidebarMenuButton asChild isActive={pathname === "/settings"} onClick={handleLinkClick} tooltip="General Settings">
              <a><Settings /><span>Settings</span></a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <Link href="/users" passHref legacyBehavior>
            <SidebarMenuButton asChild isActive={pathname === "/users"} onClick={handleLinkClick} tooltip="Manage Users">
              <a><Users /><span>Users</span></a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      </SidebarGroup> */}
    </SidebarMenu>
  )
}
