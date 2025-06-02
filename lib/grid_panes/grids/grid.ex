defmodule GridPanes.Grids.Grid do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "grids" do
    field :name, :string
    field :description, :string
    field :panes, :map

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(grid, attrs) do
    grid
    |> cast(attrs, [:name, :description, :panes])
    |> validate_required([:name, :description])
  end
end
